// src/types/adminMenu.ts

import type { ReactNode } from "react";

export type AdminMenuItem = {
  title: string;
  href: string;
  icon?: ReactNode;
};

export type AdminMenuSection = {
  title: string;
  href?: string;
  items: AdminMenuItem[];
};

