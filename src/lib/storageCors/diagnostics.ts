// src/lib/storageCors/diagnostics.ts
//
// リモートメディア(別ドメインの Storage バイト)をブラウザで読み取る際の CORS 未設定を、
// 「エラーが起きたその地点」で開発者に気づかせるための自己診断ユーティリティ。
//
// 背景:
//   ドキュメントを整備しても、辿り着かなかった開発者は CORS 未設定のまま実装を進め、
//   本番で初めて `Failed to fetch`(MSE/fetch) や tainted canvas(SecurityError) に直面する。
//   これらの素のエラーは原因が分かりにくい。そこで開発時(NODE_ENV !== "production")に限り、
//   「CORS 未設定の可能性」と対処コマンド・一次ドキュメントへの導線を console に案内する。
//
// 重要な設計方針:
//   - 原因を断定しない: `Failed to fetch` はネットワーク断 / URL 誤り / 認証失敗でも発生するため、
//     あくまで「可能性」として案内する。
//   - 本番では何もしない / ブラウザ以外でも何もしない(CORS はブラウザのフェッチ/canvas の概念)。
//   - 一次情報(設定手順・判定ルール・前提)は docs の CORS 設定ガイドに集約し、ここからは参照のみ。
//   - 新基盤の 2 バケットも診断する: 公開バケットは publicStorageHosts / 公開 base(lib/storage/ref)から、
//     非公開バケットは固定 URL /api/storage/objects/<id>(同一 origin だが 302 で非公開バケットへ飛ぶ)から判別する。

import { isPrivateObjectPath, isPublicStorageUrl, publicStorageHosts } from "@/lib/storage/ref";

/** 一次ドキュメント(設定手順・前提・判定ルール・トラブルシュートの集約先)。 */
export const STORAGE_CORS_DOC_PATH =
  "docs/setup/StorageのCORS設定（リモートメディア読み取りの基盤前提）.md";

/** CORS 設定コマンド(旧バケット用。引数なしで origin "*"、ドメイン指定で本番限定)。 */
export const STORAGE_CORS_SETUP_COMMAND = "pnpm storage:setup-cors";

/** 新基盤の公開・非公開バケットの準備コマンド(CORS を含む。origin はアプリの origin)。 */
export const STORAGE_SETUP_COMMAND = "pnpm storage:setup -- --origin <アプリの origin>";

/** Firebase Storage と判別しやすくするためのホストヒント(案内文の文言調整に使用)。 */
const FIREBASE_STORAGE_HOST_HINTS = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
  ".appspot.com",
  ".firebasestorage.app",
] as const;

/** 同一メッセージの連投を防ぐ(フラグメントを多数ループ取得する用途で console を汚さない)。 */
const warnedKeys = new Set<string>();

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function emitOnce(key: string, lines: string[]): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  // 開発時のガイドなので warn 出力に統一(error にすると CI/監視を誤って騒がせるため)
  console.warn(lines.join("\n"));
}

function looksLikeFirebaseStorageHost(host: string): boolean {
  return FIREBASE_STORAGE_HOST_HINTS.some((hint) =>
    hint.startsWith(".") ? host.endsWith(hint) : host === hint,
  );
}

/** 取得元がどのバケットか(案内文の対処を出し分ける) */
export type StorageUrlKind = "public" | "private" | "legacy" | "other";

function resolveUrl(url: string): URL | null {
  try {
    return new URL(url, isBrowser() ? window.location.href : undefined);
  } catch {
    return null;
  }
}

function isSameOrigin(parsed: URL): boolean {
  return isBrowser() && parsed.origin === window.location.origin;
}

/**
 * URL の取得元を判別する。
 * - private: 同一 origin の非公開ファイル固定 URL(302 先が非公開バケット)
 * - public: 公開 base の配下、または公開 base の独自ホスト(CDN 等)
 * - legacy: 旧 Firebase Storage のホスト(公開 base 配下以外。非公開バケットの署名 URL もここに入る)
 */
export function classifyStorageUrl(url: string): StorageUrlKind {
  const parsed = resolveUrl(url);
  if (!parsed) return "other";
  if ((isSameOrigin(parsed) || !isBrowser()) && isPrivateObjectPath(parsed.pathname)) return "private";
  // 共有ホスト(storage.googleapis.com)は base の前方一致でだけ公開と判定し、ホスト一致は旧バケットの判定より後に置く
  if (isPublicStorageUrl(parsed.href)) return "public";
  if (looksLikeFirebaseStorageHost(parsed.host)) return "legacy";
  if (publicStorageHosts().includes(parsed.host)) return "public";
  return "other";
}

/**
 * fetch の失敗が CORS / ネットワーク系の TypeError かどうかの判定。
 * ブラウザごとに文言が異なる(Chromium: Failed to fetch / Firefox: NetworkError / Safari: Load failed)。
 * いずれも CORS だけでなくネットワーク断等でも発生する点に注意(断定には使わない)。
 */
export function isCorsLikeFetchError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const message = error.message || "";
  return (
    /failed to fetch/i.test(message) ||
    /networkerror/i.test(message) ||
    /load failed/i.test(message)
  );
}

/**
 * URL が「別オリジン(=CORS 対象)」かどうかの判定。
 * 同一オリジンなら CORS は原因になり得ないので除外する。相対 URL 等は判定不能として false。
 */
export function isLikelyCrossOriginStorageUrl(url: string): boolean {
  const parsed = resolveUrl(url);
  if (!parsed) return false;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  // 非公開ファイルの固定 URL は同一 origin でも、302 先の非公開バケットで CORS が効く
  if (isPrivateObjectPath(parsed.pathname)) return true;
  if (isSameOrigin(parsed)) return false;
  return true;
}

/**
 * 別ドメインの Storage バイトを `fetch()` で読む処理が失敗したときの自己診断。
 * 開発時 & ブラウザ & CORS 系エラー & (URL 不明 or 別オリジン) のときだけ案内を出す。
 * @param error catch した例外
 * @param url 取得元 URL(分かる場合)。同一オリジンと判定できれば案内を抑制する
 */
export function diagnoseStorageFetchError(error: unknown, url?: string): void {
  if (!isDev() || !isBrowser()) return;
  if (!isCorsLikeFetchError(error)) return;
  if (url && !isLikelyCrossOriginStorageUrl(url)) return;
  emitOnce(`fetch:${url ?? ""}`, buildFetchGuidance(url));
}

/** 取得元の表示名(案内文の文言) */
function describeTarget(url?: string): string {
  if (!url) return "別ドメイン";
  const parsed = resolveUrl(url);
  if (!parsed) return "別ドメイン";
  switch (classifyStorageUrl(url)) {
    case "private":
      return "非公開バケット(固定 URL の 302 先)";
    case "public":
      return `公開バケット(${parsed.host})`;
    case "legacy":
      return `Firebase Storage(${parsed.host})`;
    default:
      return parsed.host;
  }
}

/** 対処の案内(新基盤の 2 バケットは storage:setup、それ以外は旧バケット用の設定コマンド) */
function setupGuidance(url?: string): string {
  const kind = url ? classifyStorageUrl(url) : "other";
  if (kind === "public" || kind === "private") {
    return `  対処: ${STORAGE_SETUP_COMMAND} を実行し、公開・非公開バケットに CORS を設定してください(src/lib/storage/README.md)`;
  }
  return `  対処: ${STORAGE_CORS_SETUP_COMMAND} を一度だけ実行し、バケットに CORS を設定してください`;
}

function buildFetchGuidance(url?: string): string[] {
  return [
    `[Storage CORS 診断] ${describeTarget(url)} からのバイト読み取り(fetch)に失敗しました。`,
    "  原因の可能性: Storage バケットに CORS 設定が無い",
    "    ※ ネットワーク断 / URL 誤り / 認証失敗でも同じエラーになります(断定ではありません)",
    setupGuidance(url),
    `  詳細(判定ルール・前提・手順): ${STORAGE_CORS_DOC_PATH}`,
    ...(url ? [`  取得元: ${url}`] : []),
  ];
}

/**
 * canvas が汚染(tainted)状態でエクスポートに失敗した SecurityError かどうかの判定。
 * `<img>`/`<video>` を crossOrigin 無し or CORS 未許可で読み込んだまま canvas に描画し、
 * `toBlob` / `toDataURL` / `getImageData` を呼ぶと発生する。
 */
export function isTaintedCanvasError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  if (name !== "SecurityError") return false;
  const message = (error as { message?: string }).message ?? "";
  return /tainted|canvas|cross-origin|insecure/i.test(message);
}

/**
 * 別ドメインのメディアを canvas に取り込んでエクスポート(サムネ生成・フレーム抽出等)する処理が
 * tainted canvas で失敗したときの自己診断。
 * @param error catch した例外
 * @param sourceUrl 取り込み元メディアの URL(分かる場合)
 */
export function diagnoseTaintedCanvasError(error: unknown, sourceUrl?: string): void {
  if (!isDev() || !isBrowser()) return;
  if (!isTaintedCanvasError(error)) return;
  emitOnce(`canvas:${sourceUrl ?? ""}`, buildCanvasGuidance(sourceUrl));
}

function buildCanvasGuidance(sourceUrl?: string): string[] {
  return [
    "[Storage CORS 診断] canvas からの書き出し(toBlob/toDataURL/getImageData)に失敗しました(tainted canvas)。",
    "  原因の可能性: 別ドメインのメディアを CORS 未許可で canvas に取り込んだため汚染された",
    "  対処1: 取り込み元の <img>/<video> に crossOrigin=\"anonymous\" を付与する",
    setupGuidance(sourceUrl).replace("  対処:", "  対処2:"),
    `  詳細(判定ルール・前提・手順): ${STORAGE_CORS_DOC_PATH}`,
    ...(sourceUrl ? [`  取り込み元: ${sourceUrl}`] : []),
  ];
}

/**
 * fetch のラッパー。失敗時に diagnoseStorageFetchError を通してから元の例外を再 throw する。
 * 別ドメインの Storage バイト取得はこれ経由にしておくと、開発時に自動で CORS 案内が出る。
 */
export async function fetchStorageBytes(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    diagnoseStorageFetchError(error, url);
    throw error;
  }
}

/**
 * canvas.toBlob の Promise ラッパー。tainted canvas による SecurityError を診断してから reject する。
 * リモートメディアからのサムネ生成・フレーム抽出はこれ経由にしておくと、開発時に自動で案内が出る。
 * @param sourceUrl canvas に取り込んだメディアの URL(案内文に含めるため、分かれば渡す)
 */
export function canvasToBlobSafe(
  canvas: HTMLCanvasElement,
  type?: string,
  quality?: number,
  sourceUrl?: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("canvas.toBlob が null を返しました(Blob 生成に失敗)"));
        },
        type,
        quality,
      );
    } catch (error) {
      diagnoseTaintedCanvasError(error, sourceUrl);
      reject(error);
    }
  });
}
