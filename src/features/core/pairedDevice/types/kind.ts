// src/features/core/pairedDevice/types/kind.ts
//
// 端末の種類（kind）の定義型。項目は kinds/<名前>[.<fork の名前>].ts に
// export const kind = definePairedDeviceKind({ kind: "<名前>", ... }) で置く。

import type { z } from "zod";

import type { DevicePairingFlow } from "@/features/core/pairedDevice/constants";

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
  /** 端末の種類の名前（paired_devices.kind の値・一覧の鍵。重複は読み込み時に例外） */
  kind: string;
  /** 管理画面などでの表示名（省略時は kind 名） */
  label?: string;
  /**
   * scope の形（例: z.object({ storeId: z.string().uuid(), tableId: z.string() })）。
   * 登録・更新時と、端末の認証のたびに検証する（合わなくなった端末は認証に失敗する）。
   * 認証時は JSONB に保存した値（JSON に往復した値）を検証するので、往復後も通る形にする
   * （transform で Date やクラスを作る scopeSchema は不可。登録時に invalid_scope で止まる）
   */
  scopeSchema: z.ZodType<TScope>;
  /**
   * このユーザーが管理（登録・変更・失効・ペアリング）できる端末の範囲。
   * - "all": この kind の端末をすべて管理できる
   * - scope の部分オブジェクトの配列: いずれかを含む scope の端末だけ管理できる（JSONB の包含と同じ判定）
   *   例: 店長は自分の店舗だけ → async (user) => (await myStoreIds(user.userId)).map((storeId) => ({ storeId }))
   * - 空配列: 管理できない
   *
   * 各パターンはキーを 1 つ以上持つプレーンオブジェクトで、値は JSON に損失なく往復できるものに限る。
   * `{}` や `{ storeId: undefined }` は全件に一致しかねないため、パターンごと無視される（警告が出る）。
   * 全件を許すときは "all" を返す。
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
  /**
   * 許可するペアリング方式。省略時は ["admin_issued"]（管理者がコードを発行する方式だけ）。
   * 端末側から始める方式（device_initiated）は、攻撃者が自分の端末に出したコードを管理者に
   * 承認させる誘導が成り立つので、使う kind だけ明示的に足す
   */
  pairingFlows?: readonly DevicePairingFlow[];
  /** 端末トークンの有効期間（日）。省略時は PAIRED_DEVICE_CONFIG.token.maxAgeDays */
  tokenMaxAgeDays?: number;
  /** 最後のアクセスからこの日数で無効にする（null = 無効化しない）。省略時は config の値 */
  idleRevokeDays?: number | null;
};

/**
 * kind 定義を書くためのヘルパー。scopeSchema から scope の型を推論し、
 * verify の引数に型を付ける。
 */
export function definePairedDeviceKind<const TKind extends string, TSchema extends z.ZodTypeAny>(
  definition: Omit<PairedDeviceKindDefinition<z.infer<TSchema>>, "scopeSchema" | "kind"> & {
    kind: TKind;
    scopeSchema: TSchema;
  },
): PairedDeviceKindDefinition<z.infer<TSchema>> & { kind: TKind; scopeSchema: TSchema } {
  return definition;
}

/** 一覧の要素の型（scope の型は kind ごとに異なる） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scope は kind ごとの型で、一覧ではそろわない
export type AnyPairedDeviceKindDefinition = PairedDeviceKindDefinition<any>;

/** 種類の一覧の型から、kind 名の union を導く */
export type PairedDeviceKindNamesOf<TKinds> = Extract<keyof TKinds, string>;

/** 種類の一覧の型から、kind ごとの scope の型を導く（scopeSchema から推論） */
export type PairedDeviceScopeIn<TKinds, K extends keyof TKinds> = TKinds[K] extends { scopeSchema: infer S }
  ? S extends z.ZodTypeAny
    ? z.infer<S>
    : unknown
  : unknown;
