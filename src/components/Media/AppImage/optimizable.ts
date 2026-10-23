// src/components/Media/AppImage/optimizable.ts
//
// src が Next の画像最適化(next.config.ts の remotePatterns)を通せる URL かを判定する。
// 許可外のリモート URL を next/image に最適化ありで渡すと実行時エラーで落ちるため、
// AppImage はこの判定で per-image unoptimized を自動付与し、
// IMAGE_OPTIMIZATION を ON にした瞬間に未登録ホストでクラッシュする事故を防ぐ。
//
// NOTE: 旧バケット（凍結した旧 URL）のホスト判定は、firebase SDK を伴わない純粋な URL 判定として自前で持つ。
//       新基盤（storage://・公開 base・非公開の固定 URL）の判定は lib/storage/ref の純関数を使う。

import { isPrivateObjectPath, isPublicStorageUrl } from "@/lib/storage/ref";

export function isOptimizableSrc(src: string): boolean {
  // プロトコル相対 URL は外部ホスト扱い
  if (src.startsWith("//")) return false;
  // 非公開ファイルの固定 URL は都度認可して短期署名 URL へ 302 する。最適化を通すと
  // 認可済みの画像が最適化キャッシュに残って他の利用者へ配られうるため、必ず外す（"/" 判定より先）
  if (isPrivateObjectPath(src)) return false;
  // ローカルアセット(public/ 配下)は常に最適化可能
  if (src.startsWith("/")) return true;

  // data: / blob: 等の非 http(s) は最適化対象外
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  // 新しい公開バケット（NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL の配下）。remotePatterns と同じく base の前方一致
  if (isPublicStorageUrl(src)) return true;

  // remotePatterns(next.config.ts)と同じ「自バケットのみ」判定
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) return false;
  if (url.hostname === "firebasestorage.googleapis.com") {
    return url.pathname.startsWith(`/v0/b/${bucket}/o/`);
  }
  if (url.hostname === "storage.googleapis.com") {
    return url.pathname.startsWith(`/${bucket}/`);
  }
  return false;
}
