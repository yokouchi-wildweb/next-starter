// src/app/admin/(protected)/__domainsSlug__/[id]/edit/_screen/loader.ts
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// /admin/__domainsSlug__/[id]/edit の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(編集)を渡す 1 行
// (access = serviceRegistry の get。レコードが無ければ 404。関連選択肢は関連先ごとの list の access を取得前に評価する)。

import "server-only";

import type { __Domain__ } from "@/features/__domain__/entities/model";
__LOADER_RELATION_IMPORT__
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminEditParts } from "@/wiring/domains";

export const loadAdmin__Domain__EditScreen = createLoader(
  adminEditParts<__Domain__>("__domain__", { fallbackPath: "/admin/__domainsSlug__"__EDIT_RELATIONS_ARG__ }),
);
