// src/lib/dataMigration/media.ts
//
// dataMigration のメディア列（storage オプションの列）まわりの型と小さな共通関数。クライアント・サーバーの両方から使う。
// ファイル台帳の操作（putFromServer / copy / 非公開ファイルの読み取り判定）は features/core/storageObject が持つので、
// lib は DataMigrationMediaResolver の形だけを決め、実装は API ルートが注入する（lib → features を import しない）。

/** ファイル台帳の操作。API ルートが実行者（管理者）を固定して作る（所有者 = 実行者） */
export type DataMigrationMediaResolver = {
  /** ZIP に同梱されたファイルをサーバーから書き込み、新しい ref を返す */
  putAsset(input: {
    purpose: string;
    body: Uint8Array;
    contentType: string;
    scopeId: string | null;
  }): Promise<string>;
  /** 管理下の ref、または自分の旧バケットの旧 URL を複製し、新しい ref を返す。複製できなければ throw */
  copy(input: { source: string; purpose: string; scopeId: string | null }): Promise<string>;
  /**
   * export: ref を取得用の URL にする。pub は公開 URL、priv は実行者で用途の read を判定し（admin の暗黙通過なし）、
   * 許可されたときだけ短期署名 URL。取得できなければ null
   */
  resolveExportUrl(ref: string): Promise<string | null>;
};

/** export で ZIP に入らなかったメディア値の件数と例（manifest の mediaSkipped・ヘッダ X-Media-Skipped） */
export type MediaSkipped = {
  count: number;
  /** `<ドメイン>/<レコード ID>/<列>` の形で最大 MEDIA_SKIPPED_EXAMPLE_LIMIT 件 */
  examples: string[];
};

export const MEDIA_SKIPPED_EXAMPLE_LIMIT = 5;

/** export のレスポンスヘッダ（件数）。例は X-Media-Skipped-Examples（encodeURIComponent した JSON 配列） */
export const MEDIA_SKIPPED_HEADER = "X-Media-Skipped";
export const MEDIA_SKIPPED_EXAMPLES_HEADER = "X-Media-Skipped-Examples";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
};

/** ZIP 内のファイル名の拡張子から MIME タイプを推測する（ZIP のエントリは型を持たないため）。不明なら application/octet-stream */
export function contentTypeFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
  return CONTENT_TYPE_BY_EXTENSION[ext] ?? "application/octet-stream";
}

/** 用途 ID の規約 `<camelCase のドメイン>.<列名>`（dc:generate の用途 registry と同じ） */
export function mediaPurposeOf(camelDomain: string, fieldName: string): string {
  return `${camelDomain}.${fieldName}`;
}
