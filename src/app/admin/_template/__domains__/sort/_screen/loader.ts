// src/app/admin/(protected)/__domainsSlug__/sort/_screen/loader.ts
// このファイルは pnpm generate domain が生成する(再生成で上書きされるため手で編集しない)。
// /admin/__domainsSlug__/sort の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(並び替え)を渡す 1 行
// (access = serviceRegistry の searchForSorting。登録の entity.json の sortOrderField 昇順で先頭 100 件)。

import "server-only";

import type { __Domain__ } from "@/domains/__folder__/entities/model";
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminSortParts } from "@/domains/core/admin/services/server/screenParts";

export const loadAdmin__Domain__SortScreen = createLoader(adminSortParts<__Domain__>("__domain__", "__SORT_ORDER_FIELD__"));
