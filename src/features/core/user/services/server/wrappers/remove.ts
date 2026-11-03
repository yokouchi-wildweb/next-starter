// src/features/core/user/services/server/wrappers/remove.ts
// 汎用の削除（DELETE /api/user/:id → service.remove）も softDelete と同じ手順を通す。
// base.remove だけだと deletedAt を付けるのみで、ステータス変更・ステータス履歴・クリーンアップ・監査ログが抜けるため。
// Firebase Auth は削除しない（物理削除は hardDelete）。

import { softDelete } from "./softDelete";

export async function remove(id: string): Promise<void> {
  await softDelete({ userId: id });
}
