// クーポンハンドラーレジストリ
//
// カテゴリ文字列とハンドラーの対応を管理する。
// 消費側ドメインが registerCouponHandler() で登録し、
// クーポンサービスが getCouponHandler() で取得する。

import type { CouponHandler } from "./types";

const handlers = new Map<string, CouponHandler>();

/**
 * カテゴリに対応するハンドラーを登録する
 *
 * 同一カテゴリへの再登録は上書きされる（警告をログ出力）。
 * 消費側ドメインのサービスファイルで呼び出す。
 */
export function registerCouponHandler(
  category: string,
  handler: CouponHandler
): void {
  if (handlers.has(category)) {
    console.warn(
      `[CouponHandler] カテゴリ "${category}" のハンドラーは既に登録されています。上書きします。`
    );
  }
  handlers.set(category, handler);
}

/**
 * カテゴリに対応するハンドラーを取得する
 * 未登録の場合は undefined を返す
 */
export function getCouponHandler(
  category: string
): CouponHandler | undefined {
  return handlers.get(category);
}

/**
 * 登録済みの全カテゴリ名を取得する
 * 管理画面でのカテゴリ一覧表示などに使用
 */
export function getRegisteredCategories(): string[] {
  return Array.from(handlers.keys());
}

/**
 * 登録済みの全ハンドラーをカテゴリ→ラベルのマップで返す
 * 管理画面のセレクトボックスなどに使用
 */
export function getRegisteredCategoryLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [category, handler] of handlers) {
    labels[category] = handler.label;
  }
  return labels;
}
