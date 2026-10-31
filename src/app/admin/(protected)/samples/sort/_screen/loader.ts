// src/app/admin/(protected)/samples/sort/_screen/loader.ts
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// /admin/samples/sort の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(並び替え)を渡す 1 行
// (access = serviceRegistry の searchForSorting。domain.json の sortOrderField 昇順で先頭 100 件)。

import "server-only";

import type { Sample } from "@/features/sample/entities/model";
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminSortParts } from "@/wiring/adminScreenParts";

export const loadAdminSampleSortScreen = createLoader(adminSortParts<Sample>("sample", "sort_order"));
