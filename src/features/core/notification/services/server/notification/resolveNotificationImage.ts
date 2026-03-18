// src/features/core/notification/services/server/notification/resolveNotificationImage.ts
// 通知画像のフォールバック解決
// 構造化入力からフォールバックチェーンを自動生成し、最初に存在する画像のパスを返す

import fs from "node:fs";
import path from "node:path";
import { imgPath } from "@/utils/assets";

/** 探索する拡張子（優先順） */
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"] as const;

/** 通知画像ディレクトリの実ファイルシステムパス */
const NOTIFICATION_IMAGE_DIR = path.join(
  process.cwd(),
  "public/assets/imgs/notification",
);

/** 構造化入力 */
export type NotificationImageQuery = {
  /** 通知カテゴリ（例: "wallet", "purchase", "rank_up"） */
  category: string;
  /** サブキー1（例: walletType "regular_coin"） */
  sub1?: string;
  /** サブキー2（例: changeMethod "increment"） */
  sub2?: string;
};

/**
 * 構造化入力からフォールバック候補チェーンを生成する。
 *
 * { category: "wallet", sub1: "regular_coin", sub2: "increment" }
 * → ["wallet-regular_coin-increment", "wallet-regular_coin", "wallet"]
 */
export function buildCandidates(query: NotificationImageQuery): string[] {
  const { category, sub1, sub2 } = query;
  const candidates: string[] = [];

  if (sub1 && sub2) {
    candidates.push(`${category}-${sub1}-${sub2}`);
  }
  if (sub1) {
    candidates.push(`${category}-${sub1}`);
  }
  candidates.push(category);

  return candidates;
}

/**
 * 候補キーに一致する通知画像を探索し、公開URLパスを返す。
 * 全候補が見つからなければ "default" をフォールバックとして探索する。
 * それでも見つからなければ null を返す。
 *
 * @param input - 構造化入力、または優先順に並べた候補キーの配列（後方互換）
 * @returns 公開URLパス（例: "/assets/imgs/notification/wallet.png"）または null
 *
 * @example
 * // 構造化入力（推奨）
 * resolveNotificationImage({ category: "wallet", sub1: "regular_coin", sub2: "increment" })
 * // → ["wallet-regular_coin-increment", "wallet-regular_coin", "wallet", "default"] を順に探索
 *
 * // カテゴリのみ
 * resolveNotificationImage({ category: "rank_up" })
 * // → ["rank_up", "default"] を順に探索
 *
 * // 配列で直接指定（後方互換）
 * resolveNotificationImage(["purchase-regular_coin", "purchase"])
 */
export function resolveNotificationImage(
  input: NotificationImageQuery | string[],
): string | null {
  const candidates = Array.isArray(input) ? input : buildCandidates(input);

  // 候補 + default フォールバック
  const keysToCheck = [...candidates, "default"];

  for (const key of keysToCheck) {
    for (const ext of IMAGE_EXTENSIONS) {
      const filePath = path.join(NOTIFICATION_IMAGE_DIR, `${key}${ext}`);
      if (fs.existsSync(filePath)) {
        return imgPath(`notification/${key}${ext}`);
      }
    }
  }

  return null;
}
