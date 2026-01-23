import { forwardRef, type ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { Textarea as ShadcnTextarea } from "@/components/_shadcn/textarea";

export type TextareaProps = ComponentProps<typeof ShadcnTextarea>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => {
  const { className, readOnly, disabled, ...rest } = props;
  // readOnly または disabled 時のスタイル
  const inactiveStyles =
    readOnly || disabled
      ? "bg-muted/50 text-muted-foreground cursor-not-allowed focus-visible:ring-0 focus-visible:border-border"
      : "bg-background";
  return (
    <ShadcnTextarea
      ref={ref}
      readOnly={readOnly}
      disabled={disabled}
      className={cn(inactiveStyles, className)}
      {...rest}
    />
  );
});

Textarea.displayName = "Textarea";
