// src/domains/core/admin/menu/items/chatRooms.ts

import { MessageCircle } from "lucide-react";

import type { AdminMenuItemDefinition } from "@/domains/core/admin/menu/types";

export const item: AdminMenuItemDefinition = {
  key: "chatRooms",
  category: "community",
  order: 10,
  label: "チャットルーム",
  href: "/admin/chat-rooms",
  icon: MessageCircle,
};
