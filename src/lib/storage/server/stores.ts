// src/lib/storage/server/stores.ts
//
// 保存先（store）→ バケットと prefix の解決。env は呼び出しのたびに読む（import・構築の時点では読まない）。
// - pub: 公開バケット（STORAGE_PUBLIC_BUCKET 必須。STORAGE_PUBLIC_PREFIX は任意）
// - priv: 非公開バケット（STORAGE_PRIVATE_BUCKET 必須。STORAGE_PRIVATE_PREFIX は任意）
// - legacy: 旧バケット（NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET）。ref には出さず、旧 URL の解析・削除・コピーにだけ使う
// pub / priv の env が無いとき、既定バケットへ読み替えることはしない（StorageNotConfiguredError で即失敗）。

import "server-only";

import type { StorageStoreId } from "../ref";
import type { ObjectLocation } from "./port";

export type StorageStoreName = StorageStoreId | "legacy";

type StoreEnv = { bucket: string; prefix?: string };

const STORE_ENV: Record<StorageStoreName, StoreEnv> = {
  pub: { bucket: "STORAGE_PUBLIC_BUCKET", prefix: "STORAGE_PUBLIC_PREFIX" },
  priv: { bucket: "STORAGE_PRIVATE_BUCKET", prefix: "STORAGE_PRIVATE_PREFIX" },
  legacy: { bucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" },
};

/**
 * 保存先の env が足りない状態で、その保存先を使う操作に到達したときのエラー。
 * DatabaseNotConfiguredError / FirebaseNotConfiguredError の Storage 版（判定は「未設定」のみ）。
 */
export class StorageNotConfiguredError extends Error {
  readonly store: StorageStoreName;
  readonly missing: readonly string[];

  constructor(store: StorageStoreName, missing: readonly string[]) {
    super(
      `Storage の保存先 "${store}" が未設定です。.env.development に ${missing.join(", ")} を設定してください。`,
    );
    this.name = "StorageNotConfiguredError";
    this.store = store;
    this.missing = missing;
  }
}

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function normalizePrefix(raw: string): string {
  const trimmed = raw.replace(/^\/+/, "");
  if (trimmed.length === 0) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

/** 保存先の env がそろっているか（例外は投げない） */
export function isStorageStoreConfigured(store: StorageStoreName): boolean {
  return readEnv(STORE_ENV[store].bucket).length > 0;
}

/** 保存先のバケットと prefix。未設定なら StorageNotConfiguredError */
export function getStoreConfig(store: StorageStoreName): { bucket: string; prefix: string } {
  const env = STORE_ENV[store];
  const bucket = readEnv(env.bucket);
  if (bucket.length === 0) throw new StorageNotConfiguredError(store, [env.bucket]);
  return { bucket, prefix: env.prefix ? normalizePrefix(readEnv(env.prefix)) : "" };
}

/** 保存先とオブジェクトキー（ref.ts の objectKeyOf）から物理位置を作る */
export function locationOf(store: StorageStoreName, objectKey: string): ObjectLocation {
  const { bucket, prefix } = getStoreConfig(store);
  return { bucket, path: `${prefix}${objectKey}` };
}
