// src/features/core/messaging/components/common/InboxUnreadMark/index.tsx
// 部品(props だけ): 未読の印(小さな点)。既読なら何も描かない。読み上げは「未読」

import { Span } from "@/components/TextBlocks/Span";
import { cn } from "@/lib/cn";

export type InboxUnreadMarkProps = {
  /** true = 未読(印を描く) */
  unread: boolean;
  className?: string;
};

export function InboxUnreadMark({ unread, className }: InboxUnreadMarkProps) {
  if (!unread) return null;
  return (
    <Span className={cn("inline-block size-2 shrink-0 rounded-full bg-primary", className)}>
      <Span srOnly>未読</Span>
    </Span>
  );
}
