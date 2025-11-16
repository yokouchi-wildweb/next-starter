// src/components/Admin/Sections/Footer.tsx

import { cva } from "class-variance-authority";

import { APP_FOOTER_ELEMENT_ID } from "@/constants/layout";
import { cn } from "@/lib/cn";

const footerContainer = cva(
  "h-12 flex items-center justify-center px-6 bg-secondary text-secondary-foreground shadow-inner text-sm",
);

type AdminFooterProps = {
  text?: string | null;
};

export function Footer({ text }: AdminFooterProps) {
  const year = new Date().getFullYear();
  const fallbackText = `© ${year} ORIPA DO!`;
  const sanitizedText = text?.trim() ? text : undefined;
  const resolvedText = sanitizedText
    ? sanitizedText.replace(/{{year}}/g, String(year))
    : fallbackText;

  return (
    <footer id={APP_FOOTER_ELEMENT_ID} className={cn(footerContainer())}>
      {resolvedText}
    </footer>
  );
}
