// src/components/Admin/layout/AdminFooter.tsx
import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";

const footerContainer = cva(
  "h-12 flex items-center justify-center px-6 bg-secondary text-secondary-foreground shadow-inner text-sm",
);

export function AdminFooter() {
  const year = new Date().getFullYear();
  return <footer className={cn(footerContainer())}>© {year} ORIPA DO!</footer>;
}
