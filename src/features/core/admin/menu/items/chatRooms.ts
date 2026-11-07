// src/features/core/admin/menu/items/chatRooms.ts

import { MessageCircle } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "chatRooms",
  category: "community",
  order: 10,
  label: "チャットルーム",
  href: "/admin/chat-rooms",
  icon: MessageCircle,
};
