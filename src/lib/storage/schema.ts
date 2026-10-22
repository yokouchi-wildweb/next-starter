// src/lib/storage/schema.ts
//
// メディア列の値の zod スキーマ（client-safe）。
// z.string().url() は storage:// も URL として通してしまうため、メディア列にはこちらを使う。

import { z } from "zod";

import { isStorageRef } from "./ref";

const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

/**
 * メディア列 1 件分の値: storage ref、または http(s) の URL（凍結した旧 URL）。
 * 空を許す列は呼び出し側で .nullish() を付ける。複数値の列は z.array(storageMediaValueSchema)。
 * http(s) の値を新しい行に書いてよいかはスキーマでは決めない（CRUD 連動の側で判定する）。
 */
export const storageMediaValueSchema = z
  .string()
  .trim()
  .refine((value) => isStorageRef(value) || HTTP_URL_PATTERN.test(value), {
    message: "ファイルの参照が不正です",
  });
