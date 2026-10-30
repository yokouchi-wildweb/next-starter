// src/app/admin/(protected)/sample-tags/new/_screen/loader.ts
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// /admin/sample-tags/new の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(追加)を渡す 1 行
// (access = serviceRegistry の create。関連選択肢は関連先ごとの list の access を取得前に評価する)。

import "server-only";

import { createLoader } from "@/app/admin/(protected)/guard";
import { adminCreateParts } from "@/wiring/domains";

export const loadAdminSampleTagCreateScreen = createLoader(adminCreateParts("sampleTag"));
