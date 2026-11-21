// src/lib/seamlessVideo/server/index.ts
//
// 入口 "./server": 連結リールのマニフェストを Firestore に永続化するサーバー専用ストア(Admin SDK を読む)。
// マニフェストの形・組み立て・読み取り(buildReelManifest / parseReelManifest など)は入口 "."(../index.ts)。

export { getLatestManifest, getManifest, normalizeManifestKey, saveLatestManifest, saveManifest } from "./reelManifestStore";
