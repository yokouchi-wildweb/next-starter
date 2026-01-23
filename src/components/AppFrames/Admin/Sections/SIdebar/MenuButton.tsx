// src/components/Admin/Sections/BaseSidebar/MenuButton.tsx

"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/cn";

export const adminSidebarButtonClassName =
  "inline-flex items-center gap-2 w-full justify-start px-8 py-5 text-left text-xs font-semibold uppercase text-muted-foreground rounded-none cursor-pointer transition-colors duration-200 hover:bg-sidebar-primary hover:text-sidebar-primary-foreground group-hover:bg-sidebar-primary group-hover:text-sidebar-primary-foreground";

type MenuButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
};

export const MenuButton = React.forwardRef<HTMLButtonElement, MenuButtonProps>(
  ({ asChild, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(adminSidebarButtonClassName, className)}
        {...props}
      />
    );
  },
);

MenuButton.displayName = "MenuButton";
