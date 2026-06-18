// src/lib/seamlessVideo/server/reelManifestStore.ts
//
// 連結リールのマニフェストを Firestore に永続化するサーバー専用ストア。
// 実機テスト用に「最新の 1 件」を固定キーで保持し、共有 URL から常に最新を再生できるようにする。
// ※ サーバー専用。クライアントから import しないこと(index.ts では再エクスポートしない)。

import { getServerFirestore } from "@/lib/firebase/server/app";

import type { ReelManifest } from "../manifest";

const COLLECTION = "seamlessReels";
const LATEST_ID = "demo-latest";

/** ドキュメントキーの正規化([A-Za-z0-9_-] のみ許可)。不正なら null。 */
export function normalizeManifestKey(key: string | null | undefined): string | null {
  if (key == null || key === "") return LATEST_ID;
  return /^[A-Za-z0-9_-]{1,128}$/.test(key) ? key : null;
}

/** 指定キーにマニフェストを上書き保存する(既定キーは最新スロット)。 */
export async function saveManifest(manifest: ReelManifest, key: string = LATEST_ID): Promise<void> {
  const db = getServerFirestore();
  await db.collection(COLLECTION).doc(key).set(manifest);
}

/** 指定キーのマニフェストを取得する。未保存なら null。 */
export async function getManifest(key: string = LATEST_ID): Promise<ReelManifest | null> {
  const db = getServerFirestore();
  const snap = await db.collection(COLLECTION).doc(key).get();
  if (!snap.exists) return null;
  return (snap.data() as ReelManifest) ?? null;
}

/** 最新マニフェストを固定キーに上書き保存する(後方互換)。 */
export async function saveLatestManifest(manifest: ReelManifest): Promise<void> {
  await saveManifest(manifest, LATEST_ID);
}

/** 最新マニフェストを取得する(後方互換)。 */
export async function getLatestManifest(): Promise<ReelManifest | null> {
  return getManifest(LATEST_ID);
}
