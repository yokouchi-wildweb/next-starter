// src/features/core/notification/services/server/notification/resolveNotificationImage.ts
// 通知画像のフォールバック解決
// セグメント列からフォルダ階層パスを生成し、具体→汎用の順に最初に存在する画像を返す

import fs from "node:fs";
import path from "node:path";
import { imgPath } from "@/utils/assets";
import { toKebabCase } from "@/utils/stringCase.mjs";

/** 探索する拡張子（優先順） */
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"] as const;

/** 通知画像ディレクトリの実ファイルシステムパス */
const NOTIFICATION_IMAGE_DIR = path.join(
  process.cwd(),
  "public/assets/imgs/notification",
);

/** 構造化入力 */
export type NotificationImageQuery = {
  /** 通知を表すセグメント列（例: ["wallet", "regular_coin", "INCREMENT"]） */
  segments: Array<string | null | undefined>;
};

/**
 * セグメントをファイル配置用の kebab-case に正規化する。
 * パス区切り文字は除去する。
 */
function normalizeSegment(segment: string): string {
  return toKebabCase(segment.replace(/[./\\]+/g, " ").trim());
}

/**
 * セグメント列からフォールバック候補パスを生成する。
 * 末尾セグメントはファイル名、それ以外はディレクトリになる。
 *
 * { segments: ["wallet", "regular_coin", "INCREMENT"] }
 * → ["wallet/regular-coin/increment", "wallet/regular-coin", "wallet"]
 */
export function buildCandidatePaths(query: NotificationImageQuery): string[] {
  const segments = query.segments
    .filter((s): s is string => typeof s === "string")
    .map(normalizeSegment)
    .filter(Boolean);
  const candidates: string[] = [];

  for (let length = segments.length; length > 0; length -= 1) {
    const dirs = segments.slice(0, length - 1);
    const file = segments[length - 1];
    candidates.push(dirs.length > 0 ? `${dirs.join("/")}/${file}` : file);
  }

  return candidates;
}

/**
 * 候補パスに一致する通知画像を探索し、公開URLパスを返す。
 * 全候補が見つからなければ "default" をフォールバックとして探索する。
 * それでも見つからなければ null を返す。
 *
 * @param query - セグメント列による構造化入力
 * @returns 公開URLパス（例: "/assets/imgs/notification/wallet/regular-coin/increment.png"）または null
 *
 * @example
 * resolveNotificationImage({ segments: ["wallet", "regular_coin", "INCREMENT"] })
 * // → "wallet/regular-coin/increment.*" → "wallet/regular-coin.*" → "wallet.*" → "default.*"
 *
 * resolveNotificationImage({ segments: ["rank_up"] })
 * // → "rank-up.*" → "default.*"
 */
export function resolveNotificationImage(
  query: NotificationImageQuery,
): string | null {
  const pathsToCheck = [...buildCandidatePaths(query), "default"];

  for (const candidate of pathsToCheck) {
    for (const ext of IMAGE_EXTENSIONS) {
      const filePath = path.join(NOTIFICATION_IMAGE_DIR, `${candidate}${ext}`);
      if (fs.existsSync(filePath)) {
        return imgPath(`notification/${candidate}${ext}`);
      }
    }
  }

  return null;
}
