// src/lib/storage/client/shrinkImage.ts
//
// 送る前に画像をブラウザで縮める（画像の縮小の指定 StorageImageSpec。src/lib/storage/README.md「送る前の縮小」）。
// - shrinkImageFile(file, spec): 指定で縮める（fork がアバターの切り抜きの後などで直に呼ぶ口）
// - shrinkImageForPurpose(file, purpose): 用途の方針（GET /api/storage/purposes/[purpose]）の image で縮める。
//   入力部品がサイズの検査の前に呼ぶ
// 縮めるのは jpeg / png / webp の、長い辺が maxDimension を超える物だけ。縦横比を保ち、元と同じ型で書き出す
// （型・拡張子・透過を変えない）。名前と更新日時は元の File のまま。
// 次の場合は縮めずに元の file を返す（失敗を投げない。縮められなくても送れる物は送り、サイズの検査と
// サーバーの描き直しが最後に守る）:
//   画像以外・gif（アニメーション）・svg・avif・HEIC などの対象外の型 / 長い辺が上限以下 / 縮められない環境 /
//   読めない・書き出せない / 書き出しが別の型になった / 縮めた方が元より大きい

"use client";

import { STORAGE_CONFIG } from "@/config/app/storage.config";

import type { StorageImageSpec } from "../policy/types";
import { purposeMetadataLoader, type PurposeMetadataLoader } from "./purposePolicy";
import { browserImageCodec, type ImageCodec } from "./reencodeImage";

const SHRINK_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** 縮める型か（jpeg / png / webp） */
export function canShrinkImageType(type: string): boolean {
  return SHRINK_TYPES.has(type.toLowerCase());
}

/** 書き出しの画質（0〜1）。png は可逆なので 1。指定が無ければ storage.config の imageStrip.quality の型ごとの値 */
function qualityFor(type: string, spec: StorageImageSpec): number {
  if (type === "image/png") return 1;
  const fallback = type === "image/webp" ? STORAGE_CONFIG.imageStrip.quality.webp : STORAGE_CONFIG.imageStrip.quality.jpeg;
  return (spec.quality ?? fallback) / 100;
}

/** 縮めた画像（縮めなければ元の file）を返す。失敗を投げない */
export async function shrinkImageFile(
  file: File,
  spec: StorageImageSpec,
  codec: ImageCodec = browserImageCodec,
): Promise<File> {
  const type = file.type.toLowerCase();
  if (!canShrinkImageType(type)) return file;
  if (!codec.resize || !codec.available()) return file;
  try {
    const resized = await codec.resize(file, type, qualityFor(type, spec), spec.maxDimension);
    if (!resized) return file;
    // 書き出しが別の型にフォールバックした（toBlob が型に未対応など）・縮めて大きくなった物は使わない
    if ((resized.type && resized.type.toLowerCase() !== type) || resized.size >= file.size) return file;
    return new File([resized], file.name, { type, lastModified: file.lastModified });
  } catch (error) {
    console.warn("[storage] 画像を縮められなかったため、元のファイルのまま扱います", error);
    return file;
  }
}

export type ShrinkForPurposeDeps = {
  loader?: Pick<PurposeMetadataLoader, "loadPolicy">;
  codec?: ImageCodec;
};

/**
 * 用途の方針の image で縮める。strip の用途で image があるときだけ縮め、
 * image が無い・方針を得られない（取得の失敗）・purpose が無いときは元の file（失敗を投げない）
 */
export async function shrinkImageForPurpose(
  file: File,
  purpose: string | null | undefined,
  { loader = purposeMetadataLoader, codec = browserImageCodec }: ShrinkForPurposeDeps = {},
): Promise<File> {
  if (!purpose || !canShrinkImageType(file.type)) return file;
  const policy = await loader.loadPolicy(purpose).catch(() => null);
  if (!policy || policy.metadata !== "strip" || !policy.image) return file;
  return shrinkImageFile(file, policy.image, codec);
}
