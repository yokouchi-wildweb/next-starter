// src/types/adminMenu.ts

import type { ReactNode } from "react";

export type AdminMenuItem = {
  title: string;
  href: string | null;
  icon?: ReactNode;
};

export type AdminMenuSection = {
  title: string;
  href?: string | null;;
  items: AdminMenuItem[];
};

