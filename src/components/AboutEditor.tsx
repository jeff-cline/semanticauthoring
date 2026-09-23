"use client";

import { useEffect, useRef, useState } from "react";

// A small rich-text editor for About Me.
//
// contentEditable with document.execCommand rather than a third-party editor:
// this needs bold, italic, lists and links, and nothing else. Whatever it
// produces is sanitised server-side on save regardless of what the browser
// emits, so the editor is a convenience, never the security boundary.

const TOOLS: { cmd: string; label: string; title: string }[] = [
  { cmd: "bold", label: "B", title: "Bold" },
  { cmd: "italic", label: "I", title: "Italic" },
  { cmd: "insertUnorderedList", label: "• List", title: "Bulleted list" },
  { cmd: "insertOrderedList", label: "1. List", title: "Numbered list" },
  { cmd: "formatBlock:h3", label: "Heading", title: "Heading" },
  { cmd: "formatBlock:blockquote", label: "Quote", title: "Quote" },
];

export default function AboutEditor({ name, defaultValue }:
  { name: string; defaultValue: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [html, setHtml] = useState(defaultValue || "");

  // Set the initial HTML once. Binding it on every render would move the
  // caret to the start of the field with each keystroke.
  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) ref.current.innerHTML = defaultValue || "";
  }, [defaultValue]);

  const run = (cmd: string) => {
    const [name_, arg] = cmd.split(":");
    document.execCommand(name_, false, arg);
    ref.current?.focus();
    setHtml(ref.current?.innerHTML ?? "");
  };

  const link = () => {
    const url = window.prompt("Link to which address?", "https://");
    if (!url) return;
    if (!/^(https?:\/\/|mailto:|\/)/i.test(url)) {
      window.alert("Links must start with https://, mailto: or /");
      return;
    }
    document.execCommand("createLink", false, url);
    setHtml(ref.current?.innerHTML ?? "");
  };

  return (
    <div className="field">
      <label htmlFor="about_editor">About me</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {TOOLS.map((t) => (
          <button key={t.cmd} type="button" className="pill" title={t.title}
                  style={{ cursor: "pointer", minHeight: 36, padding: "6px 12px" }}
                  onClick={() => run(t.cmd)}>
            {t.label}
          </button>
        ))}
        <button type="button" className="pill" title="Add a link"
                style={{ cursor: "pointer", minHeight: 36, padding: "6px 12px" }}
                onClick={link}>
          Link
        </button>
      </div>

      <div
        id="about_editor"
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={() => setHtml(ref.current?.innerHTML ?? "")}
        style={{
          minHeight: 180, padding: "12px 14px", borderRadius: 8,
          border: "1px solid var(--line)", background: "var(--paper, #fff)",
          lineHeight: 1.6, overflowWrap: "anywhere",
        }}
      />
      <input type="hidden" name={name} value={html} />
      <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "6px 0 0" }}>
        Bold, italics, headings, lists, quotes and links. Everything else is removed when
        saved — this appears on your public page.
      </p>
    </div>
  );
}
