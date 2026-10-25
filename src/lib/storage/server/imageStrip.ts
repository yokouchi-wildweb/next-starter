// src/lib/storage/server/imageStrip.ts
//
// metadata: "strip" の用途の画像を sharp で描き直し、メタデータを全て除く（server-only）。
// - EXIF（位置情報を含む）・XMP・IPTC・ICC を残さない。メタデータを書く API（withMetadata / keepExif /
//   keepIccProfile など）は呼ばない。色は sharp の既定で sRGB に変換してから ICC を落とす
// - 出力は入力と同じ形式（jpeg → jpeg … avif → avif）。アニメーション GIF / WebP はフレーム・ループ・コマ間隔・透過を保つ。
//   APNG と動く AVIF は sharp が 1 枚目だけを読む（静止画になる）
// - 向き: 静止画は EXIF の向きどおりに回転してからタグを捨てる。アニメーションは向き 2〜4（反転・180 度）だけ補正し、
//   5〜8（90 / 270 度回転を含む）は sharp が複数ページの回転に対応しないため、回転せずに向きの情報を捨てる。
//   sharp はアニメーションを縦に並べた 1 枚として扱うので、上下を返す補正（3・4）を全体にかけるとフレームの順番が
//   逆になる。3・4 はフレームごとに補正して並べ直す（ループ・コマ間隔は元の値を付け直す）
// - 実際の形式が申告と違えば ImageStripError("type_mismatch")、画素数の上限超えは "too_large"、
//   読めない・処理できないものは "unprocessable"
// 上限と品質の値: src/config/app/storage.config.ts の imageStrip
// sharp（ネイティブ）は初回の呼び出しで読み込む（@/lib/storage/server を使うだけのルートの起動を重くしない）

import "server-only";

import type sharp from "sharp";

import { STORAGE_CONFIG } from "@/config/app/storage.config";

import { normalizeContentType } from "../contentTypes";
import { STRIP_IMAGE_TYPES } from "../metadata";

export type ImageStripErrorKind = "type_mismatch" | "too_large" | "unprocessable";

export class ImageStripError extends Error {
  readonly kind: ImageStripErrorKind;

  constructor(kind: ImageStripErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ImageStripError";
    this.kind = kind;
  }
}

export type ImageStripOptions = {
  maxFramePixels: number;
  maxTotalPixels: number;
  quality: { jpeg: number; webp: number; avif: number };
};

export type ImageStripResult = {
  body: Uint8Array;
  /** 出力の型（入力の申告と同じ） */
  contentType: string;
};

type StripImageType = (typeof STRIP_IMAGE_TYPES)[number];

const STRIP_TYPE_SET = new Set<string>(STRIP_IMAGE_TYPES);

/** sharp の metadata が、申告の型と同じ形式か */
function formatMatches(type: StripImageType, metadata: sharp.Metadata): boolean {
  switch (type) {
    case "image/jpeg":
      return metadata.format === "jpeg";
    case "image/png":
      return metadata.format === "png";
    case "image/webp":
      return metadata.format === "webp";
    case "image/gif":
      return metadata.format === "gif";
    case "image/avif":
      // sharp は AVIF を heif として読む（HEIC は compression が hevc）
      return metadata.format === "heif" && metadata.compression === "av1";
  }
}

type Animation = { loop?: number; delay?: number[] };

function encode(
  pipeline: sharp.Sharp,
  type: StripImageType,
  quality: ImageStripOptions["quality"],
  animation: Animation = {},
): sharp.Sharp {
  switch (type) {
    case "image/jpeg":
      return pipeline.jpeg({ quality: quality.jpeg });
    case "image/png":
      return pipeline.png();
    case "image/webp":
      return pipeline.webp({ quality: quality.webp, ...animation });
    case "image/gif":
      return pipeline.gif(animation);
    case "image/avif":
      return pipeline.avif({ quality: quality.avif });
  }
}

/**
 * アニメーションの向きの補正（2〜4 だけ。5〜8 は補正せずに捨てる）。
 * 2（左右反転）は全体にかけてよい。3・4 は上下を返すので、フレームごとに補正して並べ直す
 */
async function orientAnimated(
  sharpOf: (options: sharp.SharpOptions) => sharp.Sharp,
  build: (frames: Buffer[]) => sharp.Sharp,
  metadata: sharp.Metadata,
): Promise<{ pipeline: sharp.Sharp; rebuilt: boolean }> {
  const perFrame =
    metadata.orientation === 3
      ? (frame: sharp.Sharp) => frame.rotate(180)
      : metadata.orientation === 4
        ? (frame: sharp.Sharp) => frame.flip()
        : null;
  if (!perFrame) {
    const whole = sharpOf({ animated: true });
    return { pipeline: metadata.orientation === 2 ? whole.flop() : whole, rebuilt: false };
  }
  const frames: Buffer[] = [];
  for (let page = 0; page < (metadata.pages ?? 1); page++) {
    // 中間は可逆の PNG（色の劣化を足さない）
    frames.push(await perFrame(sharpOf({ page })).png().toBuffer());
  }
  return { pipeline: build(frames), rebuilt: true };
}

/**
 * 画像を描き直し、メタデータを除いた物を返す。
 * declaredType は STRIP_IMAGE_TYPES のどれか（それ以外は "unprocessable"）。
 */
export async function stripImageMetadata(
  input: Uint8Array,
  declaredType: string,
  options: ImageStripOptions = STORAGE_CONFIG.imageStrip,
): Promise<ImageStripResult> {
  const type = normalizeContentType(declaredType);
  if (!type || !STRIP_TYPE_SET.has(type)) {
    throw new ImageStripError("unprocessable", `描き直せない型です: ${declaredType}`);
  }
  const stripType = type as StripImageType;
  const { default: sharp } = await import("sharp");

  let metadata: sharp.Metadata;
  try {
    // ヘッダーだけを読む（画素は展開しない）。上限はこの値で先に判定する
    metadata = await sharp(input, { animated: true, limitInputPixels: false }).metadata();
  } catch (error) {
    throw new ImageStripError("unprocessable", "画像として読めません", { cause: error });
  }
  if (!formatMatches(stripType, metadata)) {
    throw new ImageStripError("type_mismatch", `申告（${stripType}）と実際の形式（${metadata.format}）が違います`);
  }

  const width = metadata.width ?? 0;
  const pages = metadata.pages ?? 1;
  const frameHeight = metadata.pageHeight ?? metadata.height ?? 0;
  if (width < 1 || frameHeight < 1) throw new ImageStripError("unprocessable", "画像の寸法が読めません");
  const framePixels = width * frameHeight;
  if (framePixels > options.maxFramePixels || framePixels * pages > options.maxTotalPixels) {
    throw new ImageStripError("too_large", "画像の画素数が上限を超えています");
  }

  try {
    const sharpOf = (extra: sharp.SharpOptions) => sharp(input, { limitInputPixels: options.maxTotalPixels, ...extra });
    let pipeline: sharp.Sharp;
    let animation: Animation = {};
    if (pages > 1) {
      const oriented = await orientAnimated(
        sharpOf,
        (frames) => sharp(frames, { join: { animated: true }, limitInputPixels: options.maxTotalPixels }),
        metadata,
      );
      pipeline = oriented.pipeline;
      if (oriented.rebuilt) animation = { loop: metadata.loop, delay: metadata.delay };
    } else {
      pipeline = sharpOf({}).autoOrient();
    }
    const output = await encode(pipeline, stripType, options.quality, animation).toBuffer();
    return {
      body: new Uint8Array(output.buffer, output.byteOffset, output.byteLength),
      contentType: stripType,
    };
  } catch (error) {
    throw new ImageStripError("unprocessable", "画像を処理できません", { cause: error });
  }
}
