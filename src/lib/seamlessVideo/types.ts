// src/lib/seamlessVideo/types.ts
//
// seamlessVideo ライブラリ共通の型定義。
// 「事前に統一プロファイルへ変換された fragmented MP4(fmp4)」を入力として受け取り、
// MSE で 1 本の映像として継ぎ目なく連結再生するための型をまとめる。
// 変換(トランスコード)はこのライブラリの責務外。入力フォーマット規約は README.md を参照。

/**
 * 連結再生に渡す 1 フラグメントのソース。
 * - string: 取得用 URL(Firebase Storage の払い出し URL 等)
 * - Blob / File: アップロード直後のローカルファイル(デモのアップロード試用など)
 * - ArrayBuffer / Uint8Array: 既に読み込み済みのバイト列
 */
export type SeamlessFragmentSource = string | Blob | ArrayBuffer | Uint8Array;

/**
 * URL 文字列ソースのバイト取得をカスタマイズするためのフェッチャ。
 * 認証ヘッダ付与・独自キャッシュ・プリフェッチ・CDN 署名などをプロジェクト側で差し込める。
 * 省略時は標準の fetch を使用する(Blob/ArrayBuffer ソースには適用されない)。
 */
export type FragmentFetcher = (url: string) => Promise<ArrayBuffer>;

/**
 * fmp4 1 フラグメントを解析して得られるメタ情報。
 * 判定不能な項目は null を返す(過大判定を避け、呼び出し側で「不明」を扱えるようにする)。
 */
export type FragmentInfo = {
  /** fragmented MP4 か(moof もしくは moov 内 mvex の有無で判定) */
  isFragmented: boolean;
  /** 映像コーデック文字列。例: "avc1.640028"。avc1/avc3 以外は null */
  codec: string | null;
  /** addSourceBuffer / isTypeSupported に渡せる MIME。例: 'video/mp4; codecs="avc1.640028"' */
  mimeType: string | null;
  /** 映像の幅(px) */
  width: number | null;
  /** 映像の高さ(px) */
  height: number | null;
  /** 先頭サンプルが同期サンプル(≒キーフレーム/IDR 始まり)か。判定不能なら null */
  startsWithKeyframe: boolean | null;
  /** 音声トラックを含むか */
  hasAudio: boolean;
  /** 映像尺(秒)。trun のサンプル尺合計 / 映像トラックの timescale。算出不能なら null */
  durationSec: number | null;
};

/**
 * 音声付き連結(SeamlessReel)の 1 フラグメント。
 * 映像と音声を別ファイルで持ち、音声は Web Audio でギャップレスに連結する。
 * audio 省略時はそのフラグメントは無音(映像のみ)として扱う。
 */
export type ReelFragment = {
  /** 映像(映像のみ fmp4 推奨) */
  video: SeamlessFragmentSource;
  /** 音声(.wav 推奨 / .m4a/.aac/.mp3 も可)。省略可 */
  audio?: SeamlessFragmentSource;
};
