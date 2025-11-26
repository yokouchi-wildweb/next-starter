// src/components/Admin/Sections/BaseSidebar/MenuButton.tsx

"use client";

import * as React from "react";

import { Button } from "@/components/Form/Button/Button";
import { cn } from "@/lib/cn";

export const adminSidebarButtonClassName =
  "inline-flex items-center h-auto w-full justify-start px-8 py-5 text-left text-xs font-semibold uppercase text-muted-foreground rounded-none transition-colors duration-200 hover:bg-sidebar-primary hover:text-sidebar-primary-foreground group-hover:bg-sidebar-primary group-hover:text-sidebar-primary-foreground";

type AdminSidebarButtonProps = React.ComponentPropsWithoutRef<typeof Button>;

export const MenuButton = React.forwardRef<HTMLButtonElement, AdminSidebarButtonProps>(
  ({ className, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="lg"
      className={cn(adminSidebarButtonClassName, className)}
      {...props}
    />
  ),
);

MenuButton.displayName = "MenuButton";
