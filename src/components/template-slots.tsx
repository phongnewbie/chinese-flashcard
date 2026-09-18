"use client";

import { Fragment, type ReactNode } from "react";

const SLOT_RE = /<!--__(STUDY_INPUT|STUDY_HINT|STUDY_PIECES|STUDY_ANSWER_BOX)__-->/g;

export type StudySlotId = "STUDY_INPUT" | "STUDY_HINT" | "STUDY_PIECES" | "STUDY_ANSWER_BOX";

export function htmlHasSlot(html: string, slot: StudySlotId): boolean {
  return html.includes(`<!--__${slot}__-->`);
}

export function TemplateSlots({
  html,
  slots,
  className,
}: {
  html: string;
  slots: Partial<Record<StudySlotId, ReactNode>>;
  className?: string;
}) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  const re = new RegExp(SLOT_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    if (match.index > last) {
      const chunk = html.slice(last, match.index);
      nodes.push(
        <div
          key={`h-${i++}`}
          className={className}
          dangerouslySetInnerHTML={{ __html: chunk }}
        />,
      );
    }
    const id = match[1] as StudySlotId;
    if (slots[id] != null) {
      nodes.push(<Fragment key={`s-${i++}`}>{slots[id]}</Fragment>);
    }
    last = match.index + match[0].length;
  }
  if (last < html.length) {
    nodes.push(
      <div
        key={`h-${i++}`}
        className={className}
        dangerouslySetInnerHTML={{ __html: html.slice(last) }}
      />,
    );
  }
  return <>{nodes}</>;
}
