// src/lib/storage/server/legacy.ts
//
// 旧バケット（NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET）に保存された旧 URL → 物理位置の変換。
// 旧 URL は公開のまま凍結しており、新しい API は旧 URL を受け付けない。ここはサーバー内部で
// 業務行の物理削除に連動する削除と、管理者の複製（copy で新しい ref にする）にだけ使う。
// 自分の旧バケットとして解釈できない URL（外部 URL・他バケット）は null。

import "server-only";

import type { ObjectLocation } from "./port";
import { getStoreConfig, isStorageStoreConfigured } from "./stores";

/** トークン付きの Firebase ダウンロード URL */
const FIREBASE_DOWNLOAD_HOST = "firebasestorage.googleapis.com";
/** makePublic した公開 URL（パス形式） */
const GCS_PUBLIC_HOST = "storage.googleapis.com";

/**
 * 旧 URL を旧バケット上の位置に変換する。
 * 旧バケットが未設定・形式が違う・別バケットの URL なら null（例外は投げない）。
 */
export function parseLegacyStorageUrl(value: string | null | undefined): ObjectLocation | null {
  if (typeof value !== "string" || !isStorageStoreConfigured("legacy")) return null;
  const { bucket } = getStoreConfig("legacy");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  let encodedPath: string | null = null;
  if (url.hostname === FIREBASE_DOWNLOAD_HOST) {
    const prefix = `/v0/b/${bucket}/o/`;
    if (url.pathname.startsWith(prefix)) encodedPath = url.pathname.slice(prefix.length);
  } else if (url.hostname === GCS_PUBLIC_HOST) {
    const prefix = `/${bucket}/`;
    if (url.pathname.startsWith(prefix)) encodedPath = url.pathname.slice(prefix.length);
  }
  if (!encodedPath) return null;

  let path: string;
  try {
    path = decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
  if (path.length === 0 || path.split("/").some((segment) => segment === "..")) return null;
  return { bucket, path };
}

export function isLegacyStorageUrl(value: string | null | undefined): boolean {
  return parseLegacyStorageUrl(value) !== null;
}
