"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Link2,
  Undo2,
  Redo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RichTextCommentProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  Icon,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  Icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none",
        active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px self-center bg-border" aria-hidden />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Διεύθυνση συνδέσμου (URL):", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/40 px-1.5 py-1">
      <ToolbarButton title="Αναίρεση" Icon={Undo2} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
      <ToolbarButton title="Επανάληψη" Icon={Redo2} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
      <Divider />
      <ToolbarButton title="Επικεφαλίδα" Icon={Heading2} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <ToolbarButton title="Υποεπικεφαλίδα" Icon={Heading3} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <Divider />
      <ToolbarButton title="Έντονα" Icon={Bold} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton title="Πλάγια" Icon={Italic} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton title="Υπογράμμιση" Icon={UnderlineIcon} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolbarButton title="Διαγράμμιση" Icon={Strikethrough} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <Divider />
      <ToolbarButton title="Λίστα με κουκκίδες" Icon={List} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarButton title="Αριθμημένη λίστα" Icon={ListOrdered} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolbarButton title="Παράθεση" Icon={Quote} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <ToolbarButton title="Σύνδεσμος" Icon={Link2} active={editor.isActive("link")} onClick={setLink} />
    </div>
  );
}

export function RichTextComment({
  value,
  onChange,
  placeholder = "Εισάγετε το σχόλιο ή τον λόγο σας...",
  className,
  minHeight = "220px",
}: RichTextCommentProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { class: "text-primary underline underline-offset-2" } },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none px-3 py-2.5 focus:outline-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn("rounded-lg border border-input bg-background", className)}
        style={{ minHeight }}
      >
        <div className="px-3 py-2 text-muted-foreground text-sm">Φόρτωση επεξεργαστή…</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-background shadow-xs overflow-hidden",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40 transition-[box-shadow,border-color]",
        className,
      )}
    >
      <Toolbar editor={editor} />
      <div style={{ minHeight }} className="relative overflow-y-auto cursor-text" onClick={() => editor.chain().focus().run()}>
        {editor.isEmpty && (
          <span className="pointer-events-none absolute left-3 top-2.5 text-sm text-muted-foreground select-none">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

type CommentDisplayProps = { content: string; inline?: boolean };

/** Renders stored comment as HTML or plain text. Use only for content stored from RichTextComment. */
export function CommentDisplay({ content, inline }: CommentDisplayProps) {
  if (!content?.trim()) return null;
  const isHtml = content.trimStart().startsWith("<");
  const baseClass = "text-sm whitespace-pre-wrap break-words";
  if (isHtml) {
    const Wrapper = inline ? "span" : "div";
    return (
      <Wrapper
        className={inline ? baseClass : `prose prose-sm dark:prose-invert max-w-none ${baseClass}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return inline ? (
    <span className={baseClass}>{content}</span>
  ) : (
    <p className={baseClass}>{content}</p>
  );
}
