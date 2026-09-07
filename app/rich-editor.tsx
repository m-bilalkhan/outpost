"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  editable?: boolean;
  minHeight?: string;
};

/** Deliberately small. Headings, colours, font sizes and images all make a
 *  one-to-one email look like a marketing blast, which is the opposite of
 *  what outreach wants -- and they are the parts email clients render worst. */
const EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    code: false,
    horizontalRule: false,
    link: { openOnClick: false, autolink: true },
  }),
];

export function RichEditor({ value, onChange, editable = true, minHeight = "20rem" }: Props) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value,
    editable,
    // Next renders this on the server first; rendering the editor there too
    // produces a hydration mismatch.
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "outpost-prose focus:outline-none",
        style: `min-height:${minHeight}`,
      },
    },
  });

  // Keep the editor in step when something else rewrites the body -- the
  // Fill in button, for instance.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return (
      <div
        className="rounded border border-black/15 bg-white dark:border-white/15 dark:bg-white/5"
        style={{ minHeight }}
      />
    );
  }

  return (
    <div className="rounded border border-black/15 bg-white focus-within:border-emerald-700 dark:border-white/15 dark:bg-white/5">
      {editable && <Toolbar editor={editor} />}
      <div className="px-3 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const B = ({
    onClick,
    active,
    label,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    label: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={!!active}
      className={`min-w-7 rounded px-1.5 py-1 text-sm leading-none ${
        active
          ? "bg-emerald-800 text-white"
          : "hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-black/10 px-2 py-1.5 dark:border-white/10">
      <B label="Bold (Ctrl+B)" active={editor.isActive("bold")}
         onClick={() => editor.chain().focus().toggleBold().run()}>
        <strong>B</strong>
      </B>
      <B label="Italic (Ctrl+I)" active={editor.isActive("italic")}
         onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em>I</em>
      </B>
      <B label="Underline (Ctrl+U)" active={editor.isActive("underline")}
         onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <u>U</u>
      </B>
      <B label="Strikethrough" active={editor.isActive("strike")}
         onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </B>

      <span className="mx-1 h-4 w-px bg-black/15 dark:bg-white/15" />

      <B label="Bulleted list" active={editor.isActive("bulletList")}
         onClick={() => editor.chain().focus().toggleBulletList().run()}>
        &bull;&#8212;
      </B>
      <B label="Numbered list" active={editor.isActive("orderedList")}
         onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </B>
      <B label="Quote" active={editor.isActive("blockquote")}
         onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        &ldquo;
      </B>
      <B label="Link" active={editor.isActive("link")} onClick={setLink}>
        &#128279;
      </B>

      <span className="mx-1 h-4 w-px bg-black/15 dark:bg-white/15" />

      <B label="Clear formatting"
         onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <span className="text-xs opacity-70">clear</span>
      </B>
    </div>
  );
}
