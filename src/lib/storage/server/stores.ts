// src/lib/storage/server/stores.ts
//
// 保存先（store）→ バケットと prefix の解決。値は設定(storageConfig.stores、上書き src/config/lib/storage.config.ts)の関数を
// 呼び出しのたびに呼んで読む（import・構築の時点では読まない。lib の中は env を読まない）。上流の上書きが読む env:
// - pub: 公開バケット（STORAGE_PUBLIC_BUCKET 必須。STORAGE_PUBLIC_PREFIX は任意）
// - priv: 非公開バケット（STORAGE_PRIVATE_BUCKET 必須。STORAGE_PRIVATE_PREFIX は任意）
// - legacy: 旧バケット（NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET）。ref には出さず、旧 URL の解析・削除・コピーにだけ使う
// pub / priv が無いとき、既定バケットへ読み替えることはしない（StorageNotConfiguredError で即失敗）。

import "server-only";

import { BackendNotConfiguredError } from "@/lib/errors";

import { storageConfig, type StorageEnvValue } from "../config";
import type { StorageStoreId } from "../ref";
import type { ObjectLocation } from "./port";

export type StorageStoreName = StorageStoreId | "legacy";

/** 未設定の誤りの文に出す env の名前(上流の上書きが読む名前。読むのは上書きの関数で、ここは文言だけ) */
const BUCKET_ENV_NAME: Record<StorageStoreName, string> = {
  pub: "STORAGE_PUBLIC_BUCKET",
  priv: "STORAGE_PRIVATE_BUCKET",
  legacy: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
};

/**
 * 保存先の env が足りない状態で、その保存先を使う操作に到達したときのエラー。
 * DatabaseNotConfiguredError / FirebaseNotConfiguredError の Storage 版（判定は「未設定」のみ）。
 * 共通の親 BackendNotConfiguredError (@/lib/errors) を継ぐ(port "storage"、implementation = 保存先、missing は親の欄)。
 */
export class StorageNotConfiguredError extends BackendNotConfiguredError {
  readonly store: StorageStoreName;

  constructor(store: StorageStoreName, missing: readonly string[]) {
    super(
      `Storage の保存先 "${store}" が未設定です。.env.development に ${missing.join(", ")} を設定してください。`,
      { port: "storage", implementation: store, missing, side: "server" },
    );
    this.name = "StorageNotConfiguredError";
    this.store = store;
  }
}

/** 設定の関数を呼んで読む(呼ぶたびに読む)。空・undefined は "" */
function read(value: StorageEnvValue | undefined): string {
  return (value?.() ?? "").trim();
}

/** 保存先の設定(関数の組)。呼ぶたびに storageConfig から引く */
function storeValues(store: StorageStoreName): { bucket: StorageEnvValue; prefix?: StorageEnvValue } {
  return storageConfig.stores[store];
}

function normalizePrefix(raw: string): string {
  const trimmed = raw.replace(/^\/+/, "");
  if (trimmed.length === 0) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

/** 保存先のバケットが設定されているか（例外は投げない） */
export function isStorageStoreConfigured(store: StorageStoreName): boolean {
  return read(storeValues(store).bucket).length > 0;
}

/** 保存先のバケットと prefix。未設定なら StorageNotConfiguredError */
export function getStoreConfig(store: StorageStoreName): { bucket: string; prefix: string } {
  const values = storeValues(store);
  const bucket = read(values.bucket);
  if (bucket.length === 0) throw new StorageNotConfiguredError(store, [BUCKET_ENV_NAME[store]]);
  return { bucket, prefix: normalizePrefix(read(values.prefix)) };
}

/** 保存先とオブジェクトキー（ref.ts の objectKeyOf）から物理位置を作る */
export function locationOf(store: StorageStoreName, objectKey: string): ObjectLocation {
  const { bucket, prefix } = getStoreConfig(store);
  return { bucket, path: `${prefix}${objectKey}` };
}
