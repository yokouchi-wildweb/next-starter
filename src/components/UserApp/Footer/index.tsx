// src/components/UserAppLayout/index.tsx
import { cva } from "class-variance-authority";

import { APP_FOOTER_ELEMENT_ID } from "@/constants/layout";
import { cn } from "@/lib/cn";

const footerClass = cva(
  "h-12 flex items-center justify-center px-6 bg-secondary text-secondary-foreground shadow-inner text-sm",
);

type UserFooterProps = {
  readonly text?: string | null;
};

const resolveFooterText = (text?: string | null) => {
  const year = new Date().getFullYear();
  const fallbackText = `© ${year} ORIPA DO!`;
  const sanitized = text?.trim() ? text : undefined;

  return sanitized ? sanitized.replace(/{{year}}/g, String(year)) : fallbackText;
};

export function Index({ text }: UserFooterProps) {
  const resolvedText = resolveFooterText(text);

  return (
    <footer id={APP_FOOTER_ELEMENT_ID} className={cn(footerClass())}>
      {resolvedText}
    </footer>
  );
}

