// src/components/Admin/Sections/BaseSidebar/MenuButton.tsx

"use client";

import * as React from "react";

import { Button } from "@/components/Form/Button/Button";
import { cn } from "@/lib/cn";

export const adminSidebarButtonClassName =
  "flex h-12 w-full justify-start px-8 py-8 text-left text-xs font-semibold uppercase text-muted-foreground transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground";

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
