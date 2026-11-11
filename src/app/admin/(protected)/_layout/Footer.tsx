// src/app/admin/(protected)/_layout/Footer.tsx

import { cva } from "class-variance-authority";

import { cn } from "@/lib/cn";
import { business } from "@/business";

const footerContainer = cva(
  "h-12 flex items-center justify-center px-6 bg-background text-foreground shadow-inner text-sm",
);

export function Footer() {
  const year = new Date().getFullYear();
  const footerText = `© ${year} ${business.serviceName}`;

  return (
    <footer data-slot="admin-footer" className={cn(footerContainer())}>
      {footerText}
    </footer>
  );
}
