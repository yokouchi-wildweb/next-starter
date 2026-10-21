// src/features/core/pairedDevice/types/kind.ts
//
// 端末の種類（kind）の定義型。downstream は src/registry/pairedDeviceKindRegistry.ts に
// definePairedDeviceKind で登録する。

import type { z } from "zod";

import type { SessionUser } from "@/features/core/auth/entities/session";

/** verify フックに渡す端末とリクエストの情報 */
export type PairedDeviceVerifyContext<TScope> = {
  deviceId: string;
  kind: string;
  scope: TScope;
  /** クライアント IP（x-forwarded-for の先頭。取れない場合は null） */
  ip: string | null;
  userAgent: string | null;
};

/** manageableScopes の戻り値 */
export type PairedDeviceManageableScopes = "all" | ReadonlyArray<Record<string, unknown>>;

/** 端末の種類 1 つぶんの定義 */
export type PairedDeviceKindDefinition<TScope = unknown> = {
  /** 管理画面などでの表示名（省略時は kind 名） */
  label?: string;
  /**
   * scope の形（例: z.object({ storeId: z.string().uuid(), tableId: z.string() })）。
   * 登録・更新時と、端末の認証のたびに検証する（合わなくなった端末は認証に失敗する）
   */
  scopeSchema: z.ZodType<TScope>;
  /**
   * このユーザーが管理（登録・変更・失効・ペアリング）できる端末の範囲。
   * - "all": この kind の端末をすべて管理できる
   * - scope の部分オブジェクトの配列: いずれかを含む scope の端末だけ管理できる（JSONB の包含と同じ判定）
   *   例: 店長は自分の店舗だけ → async (user) => (await myStoreIds(user.userId)).map((storeId) => ({ storeId }))
   * - 空配列: 管理できない
   *
   * admin カテゴリのロールは常に "all"（このフックは呼ばれない）。省略時は admin 以外は管理できない。
   * 一覧の絞り込みと、1 件ごとの権限判定の両方がこの 1 つの宣言から決まる。
   */
  manageableScopes?: (
    user: SessionUser,
  ) => PairedDeviceManageableScopes | Promise<PairedDeviceManageableScopes>;
  /**
   * 端末の認証時に毎回実行する追加検証。false を返すと認証に失敗する（例外も失敗扱い）。
   * 例: 店舗の IP からのアクセスだけ通す
   */
  verify?: (ctx: PairedDeviceVerifyContext<TScope>) => boolean | Promise<boolean>;
  /** 端末トークンの有効期間（日）。省略時は PAIRED_DEVICE_CONFIG.token.maxAgeDays */
  tokenMaxAgeDays?: number;
  /** 最後のアクセスからこの日数で無効にする（null = 無効化しない）。省略時は config の値 */
  idleRevokeDays?: number | null;
};

/**
 * kind 定義を書くためのヘルパー。scopeSchema から scope の型を推論し、
 * verify の引数に型を付ける。
 */
export function definePairedDeviceKind<TSchema extends z.ZodTypeAny>(
  definition: Omit<PairedDeviceKindDefinition<z.infer<TSchema>>, "scopeSchema"> & {
    scopeSchema: TSchema;
  },
): PairedDeviceKindDefinition<z.infer<TSchema>> & { scopeSchema: TSchema } {
  return definition;
}
