// src/app/admin/(protected)/__domainsSlug__/new/_screen/loader.ts
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// /admin/__domainsSlug__/new の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(追加)を渡す 1 行
// (access = serviceRegistry の create。関連選択肢は関連先ごとの list の access を取得前に評価する)。

import "server-only";

__LOADER_RELATION_IMPORT__
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminCreateParts } from "@/wiring/domains";

export const loadAdmin__Domain__CreateScreen = createLoader(adminCreateParts("__domain__"__CREATE_RELATIONS_ARG__));
