"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that reports its own progress.
 *
 * A server action gives no feedback while it runs, so writing into a journal
 * and pressing Save looked identical whether the write succeeded, was still in
 * flight, or had failed. The button now goes disabled and says so, and the
 * page answers with a confirmation (see SavedNotice).
 */
export default function SaveButton({
  children = "Save",
  pendingLabel = "Saving…",
  className = "btn btn-primary",
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} aria-busy={pending}>
      {pending ? <><Spinner /> {pendingLabel}</> : children}
    </button>
  );
}

/** A turning wheel, so a slow save never reads as a dead page. */
export function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block", width: "0.85em", height: "0.85em",
        marginInlineEnd: 8, verticalAlign: "-0.1em",
        border: "2px solid currentColor", borderTopColor: "transparent",
        borderRadius: "50%", animation: "sa-spin .7s linear infinite",
      }}
    />
  );
}
