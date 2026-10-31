// src/app/admin/(protected)/chat-rooms/new/_screen/loader.ts
// /admin/chat-rooms/new の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(追加)を渡す 1 行。
// access = chatRoom の serviceRegistry の create(汎用 API と同じ解き方)。上流所有。差し替えは同じルートの _components/ で(src/lib/screens/README.md)

import "server-only";

import { createLoader } from "@/app/admin/(protected)/guard";
import { adminCreateParts } from "@/wiring/adminScreenParts";

export const loadAdminChatRoomCreateScreen = createLoader(adminCreateParts("chatRoom"));
