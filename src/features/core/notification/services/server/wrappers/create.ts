// src/features/core/notification/services/server/wrappers/create.ts
// 標準CRUDの create を無効化。送信は POST /api/notification/send 経由のみ。

import { DomainError } from "@/lib/errors/domainError";

export async function create(): Promise<never> {
  throw new DomainError(
    "お知らせの作成は POST /api/notification/send を使用してください。",
    { status: 405 }
  );
}
