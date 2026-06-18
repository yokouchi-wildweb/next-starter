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

/** 一次ドキュメント(設定手順・前提・判定ルール・トラブルシュートの集約先)。 */
export const STORAGE_CORS_DOC_PATH =
  "docs/how-to/initial-setup/StorageのCORS設定（リモートメディア読み取りの基盤前提）.md";

/** CORS 設定コマンド(引数なしで origin "*"、ドメイン指定で本番限定)。 */
export const STORAGE_CORS_SETUP_COMMAND = "pnpm storage:setup-cors";

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
  let parsed: URL;
  try {
    parsed = new URL(url, isBrowser() ? window.location.href : undefined);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (isBrowser() && parsed.origin === window.location.origin) return false;
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

function buildFetchGuidance(url?: string): string[] {
  let target = "別ドメイン";
  if (url) {
    try {
      const host = new URL(url, isBrowser() ? window.location.href : undefined).host;
      target = looksLikeFirebaseStorageHost(host) ? `Firebase Storage(${host})` : host;
    } catch {
      /* host 解決不能時は既定の文言のまま */
    }
  }
  return [
    `[Storage CORS 診断] ${target} からのバイト読み取り(fetch)に失敗しました。`,
    "  原因の可能性: Storage バケットに CORS 設定が無い",
    "    ※ ネットワーク断 / URL 誤り / 認証失敗でも同じエラーになります(断定ではありません)",
    `  対処: ${STORAGE_CORS_SETUP_COMMAND} を一度だけ実行し、バケットに CORS を設定してください`,
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
    `  対処2: ${STORAGE_CORS_SETUP_COMMAND} を一度だけ実行し、バケットに CORS を設定する`,
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
