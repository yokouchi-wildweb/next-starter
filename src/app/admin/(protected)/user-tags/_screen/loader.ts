// src/app/admin/(protected)/user-tags/_screen/loader.ts
// /admin/user-tags の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(一覧)を渡す 1 行。
// access = userTag の serviceRegistry の search(汎用 API と同じ解き方)。上流所有。差し替えは同じルートの _components/ で(src/lib/screens/README.md)

import "server-only";

import type { UserTag } from "@/features/core/userTag/entities/model";
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminListParts } from "@/wiring/domains";

export const loadAdminUserTagListScreen = createLoader(adminListParts<UserTag>("userTag"));
