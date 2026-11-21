// src/features/core/user/services/server/wrappers/delete.ts
// 汎用の削除（DELETE /api/user/:id → service.delete）も softDelete と同じ手順を通す。
// base.delete だけだと deletedAt を付けるのみで、ステータス変更・ステータス履歴・クリーンアップ・監査ログが抜けるため。
// Firebase Auth は削除しない（物理削除は hardDelete）。

import { softDelete } from "./softDelete";

// delete は関数名にできないので deleteUser(userService の delete に置く)
export async function deleteUser(id: string): Promise<void> {
  await softDelete({ userId: id });
}
