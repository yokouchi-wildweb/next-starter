// src/lib/storage/client/prepareStripImage.ts
//
// strip の用途へ送る前の端末側の下ごしらえ。位置情報などの除去はサーバーが commit で行う（保証はサーバー）。
// 端末がするのは、サーバーが描き直せない形式の画像（HEIC / HEIF など STRIP_IMAGE_TYPES 以外）を JPEG にすることだけ。
// - 端末で開ければ JPEG に描き直して送る（iPhone の写真を Safari 以外で選んだ場合など）
// - 開けなければ発行の前に StorageUploadError("storage/unsupported-image") で止める（サーバーも 400 で受け付けない）
// - jpeg / png / webp / gif / avif と、画像以外のファイルはそのまま返す（描き直さない）

"use client";

import { normalizeContentType } from "../contentTypes";
import { STRIP_IMAGE_TYPES } from "../metadata";
import type { ImageCodec } from "./reencodeImage";
import { StorageUploadError } from "./transferTypes";

const STRIP_IMAGE_SET = new Set<string>(STRIP_IMAGE_TYPES);
const CONVERT_TYPE = "image/jpeg";
const CONVERT_QUALITY = 0.92;

/** 型が空でも、拡張子で HEIC / HEIF と分かるもの（Windows・一部の Android は file.type を空にする） */
const HEIC_EXTENSION = /\.(heic|heif)$/i;

export const UNSUPPORTED_IMAGE_MESSAGE =
  "この画像の形式は使えません。JPEG・PNG で保存し直すか、スマートフォンの写真から直接選んでください。";

/** strip の用途で、端末で JPEG に変えてから送る画像か（STRIP_IMAGE_TYPES 以外の画像） */
export function needsClientConversion(file: Blob): boolean {
  const type = normalizeContentType(file.type);
  if (type) return type.startsWith("image/") && !STRIP_IMAGE_SET.has(type);
  const name = (file as Partial<File>).name;
  return typeof name === "string" && HEIC_EXTENSION.test(name);
}

/** strip の用途へ送る本体を返す。変換が要らなければ元の file */
export async function prepareStripImage(file: Blob, codec: ImageCodec): Promise<Blob> {
  if (!needsClientConversion(file)) return file;
  if (!codec.available()) throw new StorageUploadError("storage/unsupported-image", UNSUPPORTED_IMAGE_MESSAGE);

  let converted: Blob;
  try {
    converted = await codec.redraw(file, CONVERT_TYPE, CONVERT_QUALITY);
  } catch (error) {
    throw new StorageUploadError("storage/unsupported-image", UNSUPPORTED_IMAGE_MESSAGE, { cause: error });
  }
  // 書き出しが別の型にフォールバックしても、サーバーが描き直せる型なら使う
  const type = normalizeContentType(converted.type) ?? CONVERT_TYPE;
  if (!STRIP_IMAGE_SET.has(type)) throw new StorageUploadError("storage/unsupported-image", UNSUPPORTED_IMAGE_MESSAGE);
  return converted.type ? converted : new Blob([converted], { type });
}
