// src/lib/seamlessVideo/server/reelManifestStore.ts
//
// 連結リールのマニフェストを Firestore に永続化するサーバー専用ストア。
// 実機テスト用に「最新の 1 件」を固定キーで保持し、共有 URL から常に最新を再生できるようにする。
// ※ サーバー専用。クライアントから import しないこと(index.ts では再エクスポートしない)。

import { getServerFirestore } from "@/lib/firebase/server/app";

import type { ReelManifest } from "../manifest";

const COLLECTION = "seamlessReels";
const LATEST_ID = "demo-latest";

/** 最新マニフェストを固定キーに上書き保存する。 */
export async function saveLatestManifest(manifest: ReelManifest): Promise<void> {
  const db = getServerFirestore();
  await db.collection(COLLECTION).doc(LATEST_ID).set(manifest);
}

/** 最新マニフェストを取得する。未保存なら null。 */
export async function getLatestManifest(): Promise<ReelManifest | null> {
  const db = getServerFirestore();
  const snap = await db.collection(COLLECTION).doc(LATEST_ID).get();
  if (!snap.exists) return null;
  return (snap.data() as ReelManifest) ?? null;
}
