// src/lib/mediaProbe/types.ts
//
// サーバーサイド メディア解析（probe）capability の公開契約。
// 「ストレージ上のメディアを解析し、ストリーム構成（音声トラックの有無等）を返す」ための型。
// ※ tier1 は客観的な「事実」のみを返す。用途別ルール（背景動画=音声なし、BGM=音声あり 等）の
//   判定は消費側（ドメイン）の責務であり、この層には持ち込まない。

/** probe の失敗種別。消費側はこれを HTTP ステータスへマップできる。 */
export type ProbeErrorCode =
  /** 取得不可（URL 失効・権限・404 等） */
  | "fetch_failed"
  /** 非対応・解析不能なコンテナ */
  | "unsupported_container"
  /** 解析エンジンの失敗（破損ファイル等） */
  | "probe_failed"
  /** 解析がタイムアウト */
  | "timeout";

/** 映像ストリームの構成。判定不能な項目は null。 */
export type ProbeVideoInfo = {
  codec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
};

/** 音声ストリームの構成。判定不能な項目は null。 */
export type ProbeAudioInfo = {
  codec: string | null;
  channels: number | null;
  sampleRate: number | null;
};

/** probe が抽出した「事実」。成功結果（ProbeSuccess）から ok を除いた本体。 */
export type ProbeFacts = {
  /** 正規化済みコンテナ名。例: "mp4" | "webm" | "mp3"。判定不能なら null */
  container: string | null;
  durationSec: number | null;
  hasVideoTrack: boolean;
  /** ★ 主目的: 音声トラックの有無 */
  hasAudioTrack: boolean;
  video: ProbeVideoInfo | null;
  audio: ProbeAudioInfo | null;
};

export type ProbeSuccess = { ok: true } & ProbeFacts;

export type ProbeFailure = {
  ok: false;
  error: { code: ProbeErrorCode; message: string };
};

/** probe の結果。成功/失敗を ok で判別する判別共用体。 */
export type ProbeResult = ProbeSuccess | ProbeFailure;

/**
 * 解析対象メディアの参照。
 * - authorizedUrl: 呼び出し元が認可済みの短期 URL（storage:// の ref は呼び出し元が用途の read で判定して
 *   署名 URL にしてから渡す。lib は ref を解決しない）。サイズ・型が分かっていれば添える
 * - storagePath: 旧バケット（Firebase Storage）内のパス。署名 URL を内部で払い出す。
 *   pub / priv の保存先と重なるパスは受け付けない（lib/storage/server の legacyLocationOfPath）
 * - downloadUrl: ダウンロード URL（自分の旧バケットの URL なら位置へ正規化、それ以外は URL を直接 Range 取得。
 *   storage:// の ref は受け付けない）
 */
export type MediaRef =
  | { authorizedUrl: string; sizeBytes?: number | null; contentType?: string | null }
  | { storagePath: string }
  | { downloadUrl: string };
