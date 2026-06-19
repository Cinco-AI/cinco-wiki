"use client";

import { use } from "react";
import { NotesDashboard } from "@/components/NotesDashboard";

export default function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <NotesDashboard openNoteId={id} />;
}
