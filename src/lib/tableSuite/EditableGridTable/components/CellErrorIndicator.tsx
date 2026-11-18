import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/cn";
import { Block } from "@/components/Layout/Block";
import { Span } from "@/components/TextBlocks/Span";

type CellErrorIndicatorProps = {
  message: string;
};

export function CellErrorIndicator({ message }: CellErrorIndicatorProps) {
  return (
    <Block data-cell-error className="pointer-events-none absolute inset-0" aria-live="assertive">
      <AlertCircle
        className="absolute right-1 top-1 size-4 text-destructive-text"
        aria-label={`入力エラー: ${message}`}
      />
      <Span
        inline
        className={cn(
          "pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-md opacity-0 transition-opacity",
          "group-hover:opacity-100",
        )}
      >
        {message}
      </Span>
    </Block>
  );
}
