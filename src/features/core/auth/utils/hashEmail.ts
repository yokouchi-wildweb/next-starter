// src/features/core/auth/utils/hashEmail.ts

import { createHash } from "node:crypto";

/**
 * audit_logs の targetId に格納するための email ハッシュ。
 *
 * - 小文字化 + trim でメール正規化 (大小・前後空白の表記揺れを吸収)
 * - sha256 → hex 先頭 16 文字に truncate
 *   - 64 bit 相当 → 同一 email 集約には十分、衝突率は実用上無視可能
 *   - 短くすることで audit_logs.target_id インデックスの効率を維持
 *
 * 用途: 存在しないユーザーへのログイン試行を targetId="unknown:<hash>"
 * の形で記録し、同一 email を狙った試行パターンを集約検出可能にする。
 */
export function hashEmailForAudit(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}
