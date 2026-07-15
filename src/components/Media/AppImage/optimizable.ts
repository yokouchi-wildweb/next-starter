// src/components/Media/AppImage/optimizable.ts
//
// src が Next の画像最適化(next.config.ts の remotePatterns)を通せる URL かを判定する。
// 許可外のリモート URL を next/image に最適化ありで渡すと実行時エラーで落ちるため、
// AppImage はこの判定で per-image unoptimized を自動付与し、
// IMAGE_OPTIMIZATION を ON にした瞬間に未登録ホストでクラッシュする事故を防ぐ。
//
// NOTE: 自バケット判定は lib/storage/client の getPathFromStorageUrl と同等だが、
//       あちらは firebase client SDK の初期化を伴うモジュールに同居しているため、
//       純粋な URL 判定だけが必要な UI プリミティブからは依存せず自前で持つ。

export function isOptimizableSrc(src: string): boolean {
  // プロトコル相対 URL は外部ホスト扱い
  if (src.startsWith("//")) return false;
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
