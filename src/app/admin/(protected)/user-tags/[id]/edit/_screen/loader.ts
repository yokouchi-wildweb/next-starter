// src/app/admin/(protected)/user-tags/[id]/edit/_screen/loader.ts
// /admin/user-tags/[id]/edit の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(編集)を渡す 1 行。
// access = userTag の serviceRegistry の get(汎用 API と同じ解き方)。上流所有。差し替えは同じルートの _components/ で(src/lib/screens/README.md)

import "server-only";

import type { UserTag } from "@/features/core/userTag/entities/model";
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminEditParts } from "@/wiring/adminScreenParts";

export const loadAdminUserTagEditScreen = createLoader(adminEditParts<UserTag>("userTag", { fallbackPath: "/admin/user-tags" }));
