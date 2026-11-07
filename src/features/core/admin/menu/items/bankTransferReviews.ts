// src/features/core/admin/menu/items/bankTransferReviews.ts

import { Banknote } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "bankTransferReviews",
  category: "requests",
  order: 10,
  label: "銀行振込レビュー",
  href: "/admin/bank-transfer-reviews/pending-review",
  icon: Banknote,
  allowRoles: ["admin"],
};
