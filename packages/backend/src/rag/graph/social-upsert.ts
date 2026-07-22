import type { Db } from "mongodb";
import { isGraphConfigured } from "../config.js";
import {
  collectUserIds,
  loadCommentsForNotes,
  loadUsersByIds,
  loadVotesForNotes,
  type GraphComment,
  type GraphUser,
  type GraphVote,
} from "../social-source.js";
import type { NoteSource } from "../types.js";
import { extractInternalNoteLinks } from "./links.js";
import { getNeo4jDriver } from "./neo4j.js";
import { ensureGraphSchema } from "./schema.js";

async function upsertUsers(users: GraphUser[]): Promise<void> {
  if (users.length === 0) return;
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    await session.run(
      `
      UNWIND $users AS row
      MERGE (u:User {id: row.id})
      SET u.firstName = row.firstName, u.lastName = row.lastName
      `,
      { users },
    );
  } finally {
    await session.close();
  }
}

async function upsertNoteCore(
  note: NoteSource,
  author?: GraphUser | null,
): Promise<void> {
  const driver = getNeo4jDriver();
  const session = driver.session();
  const linkIds = extractInternalNoteLinks(note.contentHtml).filter(
    (id) => id !== note.id,
  );

  try {
    await session.run(
      `
      MERGE (n:Note {id: $id})
      SET n.title = $title,
          n.urlPath = $urlPath,
          n.avgRating = $avgRating,
          n.voteCount = $voteCount,
          n.commentCount = $commentCount,
          n.status = $status
      WITH n
      OPTIONAL MATCH (n)-[r:HAS_TAG|LINKS_TO]->()
      DELETE r
      WITH n
      OPTIONAL MATCH (u:User)-[ar:AUTHORED]->(n)
      DELETE ar
      WITH n
      OPTIONAL MATCH (n)-[old:AUTHORED_BY]->()
      DELETE old
      `,
      {
        id: note.id,
        title: note.title,
        urlPath: `/${note.id}`,
        avgRating: note.avgRating,
        voteCount: note.voteCount,
        commentCount: note.commentCount,
        status: note.status,
      },
    );

    if (note.tags.length > 0) {
      await session.run(
        `
        MATCH (n:Note {id: $id})
        UNWIND $tags AS tagName
        MERGE (t:Tag {name: tagName})
        MERGE (n)-[:HAS_TAG]->(t)
        `,
        { id: note.id, tags: note.tags },
      );
    }

    if (note.authorId && author) {
      await session.run(
        `
        MATCH (n:Note {id: $id})
        MERGE (u:User {id: $authorId})
        SET u.firstName = $firstName, u.lastName = $lastName
        MERGE (u)-[:AUTHORED]->(n)
        `,
        {
          id: note.id,
          authorId: note.authorId,
          firstName: author.firstName,
          lastName: author.lastName,
        },
      );
    } else if (note.authorId) {
      await session.run(
        `
        MATCH (n:Note {id: $id})
        MERGE (u:User {id: $authorId})
        ON CREATE SET u.firstName = '', u.lastName = ''
        MERGE (u)-[:AUTHORED]->(n)
        `,
        { id: note.id, authorId: note.authorId },
      );
    }

    if (linkIds.length > 0) {
      await session.run(
        `
        MATCH (n:Note {id: $id})
        UNWIND $linkIds AS targetId
        MERGE (t:Note {id: targetId})
        ON CREATE SET t.title = targetId, t.urlPath = '/' + targetId
        MERGE (n)-[:LINKS_TO]->(t)
        `,
        { id: note.id, linkIds },
      );
    }
  } finally {
    await session.close();
  }
}

async function replaceNoteSocialEdges(
  noteId: string,
  votes: GraphVote[],
  comments: GraphComment[],
): Promise<void> {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    // Clear prior RATED / comment subgraph for this note
    await session.run(
      `
      MATCH (n:Note {id: $id})
      OPTIONAL MATCH (u:User)-[r:RATED]->(n)
      DELETE r
      WITH n
      OPTIONAL MATCH (c:Comment)-[:ON_NOTE]->(n)
      DETACH DELETE c
      `,
      { id: noteId },
    );

    const noteVotes = votes.filter((v) => v.noteId === noteId);
    if (noteVotes.length > 0) {
      await session.run(
        `
        MATCH (n:Note {id: $noteId})
        UNWIND $votes AS row
        MERGE (u:User {id: row.userId})
        ON CREATE SET u.firstName = '', u.lastName = ''
        MERGE (u)-[r:RATED]->(n)
        SET r.value = row.value, r.updatedAt = datetime(row.updatedAt)
        `,
        {
          noteId,
          votes: noteVotes.map((v) => ({
            userId: v.userId,
            value: v.value,
            updatedAt: v.updatedAt.toISOString(),
          })),
        },
      );
    }

    const noteComments = comments.filter((c) => c.noteId === noteId);
    for (const c of noteComments) {
      await session.run(
        `
        MATCH (n:Note {id: $noteId})
        MERGE (c:Comment {id: $id})
        SET c.textPreview = $textPreview, c.createdAt = datetime($createdAt)
        MERGE (c)-[:ON_NOTE]->(n)
        WITH c
        OPTIONAL MATCH (u:User)-[w:WROTE]->(c)
        DELETE w
        WITH c
        OPTIONAL MATCH (u2:User)-[re:REACTED]->(c)
        DELETE re
        `,
        {
          noteId,
          id: c.id,
          textPreview: c.textPreview,
          createdAt: c.createdAt.toISOString(),
        },
      );

      if (c.authorId) {
        await session.run(
          `
          MATCH (c:Comment {id: $id})
          MERGE (u:User {id: $authorId})
          ON CREATE SET u.firstName = '', u.lastName = ''
          MERGE (u)-[:WROTE]->(c)
          `,
          { id: c.id, authorId: c.authorId },
        );
      }

      for (const reaction of c.reactions) {
        if (reaction.userIds.length === 0) continue;
        await session.run(
          `
          MATCH (c:Comment {id: $id})
          UNWIND $userIds AS uid
          MERGE (u:User {id: uid})
          ON CREATE SET u.firstName = '', u.lastName = ''
          MERGE (u)-[r:REACTED]->(c)
          SET r.emoji = $emoji
          `,
          {
            id: c.id,
            userIds: reaction.userIds,
            emoji: reaction.emoji,
          },
        );
      }
    }
  } finally {
    await session.close();
  }
}

/** Full graph rebuild for a set of published notes (structure + social). */
export async function upsertSocialGraph(
  db: Db,
  notes: NoteSource[],
): Promise<{ notes: number; votes: number; comments: number }> {
  if (!isGraphConfigured()) {
    return { notes: 0, votes: 0, comments: 0 };
  }
  await ensureGraphSchema();

  const noteIds = notes.map((n) => n.id);
  const votes = await loadVotesForNotes(db, noteIds);
  const comments = await loadCommentsForNotes(db, noteIds);
  const userIds = collectUserIds({
    authorIds: notes.map((n) => n.authorId),
    votes,
    comments,
  });
  const users = await loadUsersByIds(db, userIds);
  await upsertUsers([...users.values()]);

  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    await session.run(
      `
      MATCH (n:Note)
      WHERE NOT n.id IN $keepIds
      DETACH DELETE n
      `,
      { keepIds: noteIds },
    );
    // Orphan comments not linked to remaining notes
    await session.run(`
      MATCH (c:Comment)
      WHERE NOT (c)-[:ON_NOTE]->(:Note)
      DETACH DELETE c
    `);
  } finally {
    await session.close();
  }

  for (const note of notes) {
    const author = note.authorId ? users.get(note.authorId) : null;
    await upsertNoteCore(note, author);
    await replaceNoteSocialEdges(note.id, votes, comments);
  }

  console.log(
    `[rag] neo4j social upsert: notes=${notes.length} votes=${votes.length} comments=${comments.length}`,
  );
  return {
    notes: notes.length,
    votes: votes.length,
    comments: comments.length,
  };
}

/** Incremental: one published note + its votes/comments. */
export async function upsertNoteSocialGraph(
  db: Db,
  note: NoteSource,
): Promise<void> {
  if (!isGraphConfigured()) return;
  await ensureGraphSchema();

  const votes = await loadVotesForNotes(db, [note.id]);
  const comments = await loadCommentsForNotes(db, [note.id]);
  const userIds = collectUserIds({
    authorIds: [note.authorId],
    votes,
    comments,
  });
  const users = await loadUsersByIds(db, userIds);
  await upsertUsers([...users.values()]);

  const author = note.authorId ? users.get(note.authorId) : null;
  await upsertNoteCore(note, author);
  await replaceNoteSocialEdges(note.id, votes, comments);
}

export async function deleteNoteGraph(noteId: string): Promise<void> {
  if (!isGraphConfigured()) return;
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    await session.run(
      `
      MATCH (n:Note {id: $id})
      OPTIONAL MATCH (c:Comment)-[:ON_NOTE]->(n)
      DETACH DELETE c, n
      `,
      { id: noteId },
    );
  } finally {
    await session.close();
  }
}
