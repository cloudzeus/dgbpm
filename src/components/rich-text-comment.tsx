"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type RichTextCommentProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

export function RichTextComment({
  value,
  onChange,
  placeholder = "Enter your comment or reason...",
  className,
  minHeight = "220px",
}: RichTextCommentProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[200px] px-3 py-2 focus:outline-none",
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

  const setBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const setItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const setBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const setOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);

  if (!editor) {
    return (
      <div
        className={cn("rounded-md border border-input bg-transparent", className)}
        style={{ minHeight }}
      >
        <div className="px-3 py-2 text-muted-foreground text-sm">Loading editor…</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-transparent shadow-xs overflow-hidden",
        className
      )}
    >
      <div className="flex flex-wrap gap-1 border-b border-input bg-muted/30 px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={setBold}
          className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-muted")}
          title="Bold"
        >
          <span className="font-bold text-sm">B</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={setItalic}
          className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-muted")}
          title="Italic"
        >
          <span className="italic text-sm">I</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={setBulletList}
          className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-muted")}
          title="Bullet list"
        >
          <span className="text-sm">• List</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={setOrderedList}
          className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "bg-muted")}
          title="Numbered list"
        >
          <span className="text-sm">1. List</span>
        </Button>
      </div>
      <div style={{ minHeight }} className="overflow-y-auto">
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
