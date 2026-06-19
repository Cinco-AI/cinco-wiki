"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link2,
  Image as ImageIcon,
  Table as TableIcon,
  Baseline,
  Highlighter,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

/** Bouton de la barre d'outils — reflète l'état actif via aria-pressed. */
function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition",
        "hover:bg-brand-50 hover:text-brand-700",
        "focus:outline-none focus:ring-2 focus:ring-brand-200",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-600",
        active && "bg-brand-100 text-brand-700",
      )}
    >
      {children}
    </button>
  );
}

/** Sélecteur de couleur (texte ou surlignage) basé sur un input natif accessible. */
function ColorButton({
  label,
  value,
  onPick,
  onReset,
  children,
}: {
  label: string;
  value: string;
  onPick: (color: string) => void;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center">
      <label
        title={label}
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-600 transition hover:bg-brand-50 hover:text-brand-700 focus-within:ring-2 focus-within:ring-brand-200"
        style={{ color: value }}
      >
        {children}
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onReset}
        aria-label={`Réinitialiser ${label.toLowerCase()}`}
        title={`Réinitialiser ${label.toLowerCase()}`}
        className="flex h-8 w-5 items-center justify-center rounded-lg text-gray-400 transition hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        <Minus className="h-3 w-3" />
      </button>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-6 w-px shrink-0 self-center bg-gray-200" />;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  // Ref pour éviter les closures périmées dans onUpdate (l'éditeur n'est créé qu'une fois).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
      Image.configure({ allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose-note min-h-[16rem] px-4 py-3 focus:outline-none",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Contenu de la note",
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML()),
  });

  // Synchronise une valeur externe (ex. chargement asynchrone en mode édition).
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="min-h-[16rem] animate-pulse rounded-xl border border-gray-200 bg-white shadow-sm" />
    );
  }

  const setLink = () => {
    const previous = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("URL du lien", previous);
    if (url === null) return; // annulé
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const addImage = () => {
    const url = window.prompt("URL de l'image");
    if (url && url.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  const inTable = editor.isActive("table");
  const currentColor = (editor.getAttributes("textStyle").color as string | undefined) ?? "#111827";
  const currentHighlight =
    (editor.getAttributes("highlight").color as string | undefined) ?? "#fff8e1";

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
      <div
        role="toolbar"
        aria-label="Mise en forme"
        aria-controls="rte-content"
        className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 p-1.5"
      >
        {/* Styles de caractère */}
        <ToolbarButton
          label="Gras"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italique"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Souligné"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Barré"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Code en ligne"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* Titres */}
        <ToolbarButton
          label="Titre 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Titre 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Titre 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* Listes */}
        <ToolbarButton
          label="Liste à puces"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Liste numérotée"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Liste de tâches"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListTodo className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* Blocs */}
        <ToolbarButton
          label="Citation"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bloc de code"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* Alignements */}
        <ToolbarButton
          label="Aligner à gauche"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Centrer"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Aligner à droite"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Justifier"
          active={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* Lien / image / tableau */}
        <ToolbarButton label="Lien" active={editor.isActive("link")} onClick={setLink}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Insérer une image" onClick={addImage}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Insérer un tableau"
          active={inTable}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* Couleurs */}
        <ColorButton
          label="Couleur du texte"
          value={currentColor}
          onPick={(c) => editor.chain().focus().setColor(c).run()}
          onReset={() => editor.chain().focus().unsetColor().run()}
        >
          <Baseline className="h-4 w-4" />
        </ColorButton>
        <ColorButton
          label="Surlignage"
          value={currentHighlight}
          onPick={(c) => editor.chain().focus().toggleHighlight({ color: c }).run()}
          onReset={() => editor.chain().focus().unsetHighlight().run()}
        >
          <Highlighter className="h-4 w-4" />
        </ColorButton>

        {/* Outils de tableau contextuels */}
        {inTable && (
          <>
            <Divider />
            <ToolbarButton
              label="Ajouter une colonne"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <Plus className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Supprimer la colonne"
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <Minus className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Ajouter une ligne"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <Plus className="h-4 w-4 rotate-90" />
            </ToolbarButton>
            <ToolbarButton
              label="Supprimer la ligne"
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <Minus className="h-4 w-4 rotate-90" />
            </ToolbarButton>
            <ToolbarButton
              label="Supprimer le tableau"
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              <Trash2 className="h-4 w-4" />
            </ToolbarButton>
          </>
        )}
      </div>

      <EditorContent id="rte-content" editor={editor} className="scrollbar-thin max-h-[32rem] overflow-y-auto" />
    </div>
  );
}
