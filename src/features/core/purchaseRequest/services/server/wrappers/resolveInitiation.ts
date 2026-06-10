// src/features/core/purchaseRequest/services/server/wrappers/resolveInitiation.ts
//
// 購入開始の「既存リクエストに対し次に何をすべきか」を決定する純粋関数。
//
// 設計方針（専門家パネルの指摘を反映）:
// - DB I/O・provider 呼び出しは一切行わない。取得済みの値だけで判定する純粋関数にし、
//   全状態の網羅性を assertNever で型レベルに保証する（テスト容易・分岐の抜け防止）。
// - 戻り値 InitiationOutcome は「分類」のみ（instruction/URL を持たない）。Launch 生成は
//   後段の buildLaunchForRequest に一本化する。
// - 競合は throw せず conflict として値で返し、境界（initiatePurchase）で DomainError 化する。
//
// initiatePurchase はこの戻り値に応じて副作用（create / update / createSession / エラー化）を
// dispatch する薄いオーケストレータになる。

import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import type {
  InitiationOutcome,
  LaunchType,
} from "@/features/core/purchaseRequest/types/payment";
import type { PaymentProviderName } from "../payment";

/** discriminated union の網羅性を型レベルで強制する。未処理の status があればコンパイルエラー。 */
function assertNever(x: never): never {
  throw new Error(`resolveInitiation: 未処理の purchase_request.status: ${String(x)}`);
}

/**
 * 既存リクエスト（user スコープで取得済み）と今回の intent から、次のアクションを決定する。
 *
 * @param existing       冪等キー＋user_id で引いた既存リクエスト（無ければ null）
 * @param intentProvider 今回の購入意図が解決したプロバイダ名
 * @param launchType     intentProvider の起動方式（resume の分岐軸）
 */
export function resolveInitiation(args: {
  existing: PurchaseRequest | null;
  intentProvider: PaymentProviderName;
  launchType: LaunchType;
}): InitiationOutcome {
  const { existing, intentProvider, launchType } = args;

  // 既存が無ければ新規作成。冪等キーは intent 依存なので、支払い方法/金額を変えれば
  // 別キー＝既存ヒットせず create に落ちる（＝別 provider の processing を掴むバグの構造的解消）。
  if (!existing) {
    return { kind: "create" };
  }

  const status = existing.status;
  switch (status) {
    case "pending":
      // 同一冪等キー＝同一 intent の未確定。金額・クーポンを再検証して再セッション。
      return { kind: "reuse-pending", request: existing };

    case "processing":
      // 別プロバイダで進行中のものを掴んだ場合は競合（intent 由来キーなら通常起きないが防御）。
      if (existing.payment_provider !== intentProvider) {
        return { kind: "conflict", request: existing, reason: "provider-mismatch" };
      }
      // 同一プロバイダの再起動。launchType により後段が URL 再利用 or createSession 再実行を選ぶ。
      return { kind: "resume", request: existing, launchType };

    case "completed":
      return { kind: "completed", request: existing };

    case "failed":
    case "expired":
      // 終端状態。同一冪等キーでの再試行は不可（新しい intent＝新キーで開始させる）。
      return { kind: "conflict", request: existing, reason: "terminal" };

    default:
      return assertNever(status);
  }
}
