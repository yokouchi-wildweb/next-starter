// src/components/Admin/Sections/Footer.tsx

import { cva } from "class-variance-authority";

import { APP_FOOTER_ELEMENT_ID } from "@/constants/layout";
import { cn } from "@/lib/cn";
import { businessConfig } from "@/config/business.config";

const footerContainer = cva(
  "h-12 flex items-center justify-center px-6 bg-background text-foreground shadow-inner text-sm",
);

export function Footer() {
  const year = new Date().getFullYear();
  const footerText = `© ${year} ${businessConfig.serviceName}`;

  return (
    <footer id={APP_FOOTER_ELEMENT_ID} className={cn(footerContainer())}>
      {footerText}
    </footer>
  );
}
