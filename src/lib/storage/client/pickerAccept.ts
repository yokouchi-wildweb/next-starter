// src/lib/storage/client/pickerAccept.ts
//
// ファイル選択（<input type="file" accept>）に渡す accept を、用途の metadata に合わせる（client-safe の純関数）。
// strip のとき "image/*" を STRIP_IMAGE_TYPES の列挙に置き換える。
// iOS は accept が HEIC を含まない具体型の列挙なら写真を JPEG に変換して渡し、"image/*" なら HEIC のまま渡すため。
// 列挙にある STRIP_IMAGE_TYPES 以外の画像の型（image/heic など。strip では受け付けない）は外す。拡張子（.heic など）と画像以外の型はそのまま。
// keep のときは accept を変えない。accept が無い（何でも選べる）ときも変えない。

import { STRIP_IMAGE_TYPES } from "../metadata";
import type { StorageMetadataPolicy } from "../policy/types";

const STRIP_IMAGE_SET = new Set<string>(STRIP_IMAGE_TYPES);

/** 用途の metadata（省略 = strip）に合わせた accept を返す */
export function pickerAcceptFor(
  accept: string | null | undefined,
  metadata: StorageMetadataPolicy | undefined,
): string | undefined {
  if (!accept) return accept ?? undefined;
  if ((metadata ?? "strip") === "keep") return accept;

  const result: string[] = [];
  for (const raw of accept.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const lower = entry.toLowerCase();
    const expanded =
      lower === "image/*" ? [...STRIP_IMAGE_TYPES] : lower.startsWith("image/") && !STRIP_IMAGE_SET.has(lower) ? [] : [entry];
    for (const item of expanded) {
      if (!result.includes(item)) result.push(item);
    }
  }
  // 画像の型だけを外して空になったら（例: "image/heic"）、空 = 何でも選べる にせず受け付ける画像の型にする
  return result.length > 0 ? result.join(",") : STRIP_IMAGE_TYPES.join(",");
}
