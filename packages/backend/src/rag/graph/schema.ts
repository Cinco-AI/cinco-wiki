import { getNeo4jDriver } from "./neo4j.js";

export async function ensureGraphSchema(): Promise<void> {
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    await session.run(
      "CREATE CONSTRAINT note_id IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE",
    );
    await session.run(
      "CREATE CONSTRAINT tag_name IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE",
    );
    await session.run(
      "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
    );
    await session.run(
      "CREATE CONSTRAINT comment_id IF NOT EXISTS FOR (c:Comment) REQUIRE c.id IS UNIQUE",
    );

    // Migrate legacy Author → User
    await session.run(`
      MATCH (a:Author)
      WITH a
      MERGE (u:User {id: a.id})
      SET u.firstName = coalesce(u.firstName, a.firstName, ''),
          u.lastName = coalesce(u.lastName, a.lastName, '')
      WITH a, u
      OPTIONAL MATCH (n:Note)-[r:AUTHORED_BY]->(a)
      FOREACH (_ IN CASE WHEN n IS NULL THEN [] ELSE [1] END |
        MERGE (u)-[:AUTHORED]->(n)
        DELETE r
      )
      DETACH DELETE a
    `);
  } finally {
    await session.close();
  }
}
