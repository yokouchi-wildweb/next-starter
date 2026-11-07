// src/features/core/admin/menu/items/coupons.ts

import { Ticket } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "coupons",
  category: "marketing",
  order: 30,
  label: "クーポン",
  href: "/admin/coupons/official",
  icon: Ticket,
};
