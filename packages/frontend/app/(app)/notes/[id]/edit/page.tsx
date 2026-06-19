"use client";

import { use } from "react";
import { NoteEditor } from "@/components/NoteEditor";

export default function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <NoteEditor mode="edit" noteId={id} />;
}
