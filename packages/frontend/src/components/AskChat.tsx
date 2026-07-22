"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { AlertCircle, Loader2, Send, Trash2 } from "lucide-react";
import { ApiClientError, api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

/** Relative note path, or absolute URL whose path is a Mongo ObjectId note. */
function noteInternalPath(href?: string): string | null {
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const path = new URL(href).pathname;
    if (/^\/[a-f0-9]{24}$/i.test(path)) return path;
  } catch {
    /* ignore invalid URL */
  }
  return null;
}

function MarkdownLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const internal = noteInternalPath(href);
  if (internal) {
    return (
      <Link
        href={internal}
        className="font-medium text-brand-600 underline-offset-2 hover:underline"
      >
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand-600 underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: ChatMessage = { id: newId(), role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await api.raw<{
        available: boolean;
        answer?: string;
        error?: string;
      }>("/rag/chat", {
        method: "POST",
        body: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          locale: "fr",
        },
      });

      if (!res.available || res.error) {
        setError(res.error || "RAG_UNAVAILABLE");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: res.answer || "Aucune réponse.",
        },
      ]);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erreur de chat";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <Breadcrumbs
        className="mb-2"
        items={[{ label: "Accueil", href: "/" }, { label: "Assistant Wiki" }]}
      />

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assistant Wiki</h1>
          <p className="mt-1 text-sm text-gray-500">
            Questions sur les notes publiées.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setError(null);
          }}
          disabled={busy || messages.length === 0}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-medium text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Effacer
        </button>
      </div>

      <div className="min-h-[40vh] space-y-4 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        {messages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-sm text-gray-500">
            Essayez : « Quelles notes parlent d&apos;onboarding ? » ou « Liste
            les tags disponibles ».
          </p>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
              message.role === "user"
                ? "ml-8 bg-brand-600 text-white"
                : "mr-8 border border-gray-100 bg-white text-gray-900 shadow-sm"
            }`}
          >
            <div
              className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
                message.role === "user" ? "text-white/70" : "text-gray-400"
              }`}
            >
              {message.role === "user" ? "Vous" : "Assistant"}
            </div>
            {message.role === "assistant" ? (
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                <ReactMarkdown components={{ a: MarkdownLink }}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap">{message.content}</div>
            )}
          </div>
        ))}

        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Réflexion en cours…
          </span>
        ) : null}

        {error ? (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 mt-6 flex flex-col-reverse gap-2 rounded-xl border border-gray-100 bg-white/90 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Votre question…"
          disabled={busy}
          aria-label="Message à l'assistant"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2 font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          Envoyer
        </button>
      </form>
    </div>
  );
}
