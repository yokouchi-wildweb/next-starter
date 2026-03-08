// src/features/core/notification/services/server/wrappers/update.ts
// 公開済み（published_at <= now()）のお知らせは編集不可。予約中のみ更新可能。

import { DomainError } from "@/lib/errors/domainError";

import { base } from "../drizzleBase";

export async function update(
  id: string,
  data: Parameters<typeof base.update>[1]
) {
  const existing = await base.get(id);

  if (!existing) {
    throw new DomainError("お知らせが見つかりません。", { status: 404 });
  }

  if (existing.published_at <= new Date()) {
    throw new DomainError(
      "公開済みのお知らせは編集できません。",
      { status: 400 }
    );
  }

  return base.update(id, data);
}
