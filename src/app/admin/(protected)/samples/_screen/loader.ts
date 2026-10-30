// src/app/admin/(protected)/samples/_screen/loader.ts
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// /admin/samples の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(一覧)を渡す 1 行
// (access = serviceRegistry の search、汎用 API と同じ解き方)。差し替えは _components/ に loader.ts を書き Screen と一緒に向ける。

import "server-only";

import type { Sample } from "@/features/sample/entities/model";
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminListParts } from "@/wiring/domains";

export const loadAdminSampleListScreen = createLoader(adminListParts<Sample>("sample"));
