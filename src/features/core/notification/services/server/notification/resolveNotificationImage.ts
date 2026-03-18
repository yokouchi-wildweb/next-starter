// src/features/core/notification/services/server/notification/resolveNotificationImage.ts
// 通知画像のフォールバック解決
// 候補キーの配列を受け取り、最初に存在する画像のパスを返す

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

/**
 * 候補キーに一致する通知画像を探索し、公開URLパスを返す。
 * 全候補が見つからなければ "default" をフォールバックとして探索する。
 * それでも見つからなければ null を返す。
 *
 * @param candidates - 優先順に並べた候補キー（拡張子なし）
 *   例: ["wallet-regular_coin-increment", "wallet-regular_coin", "wallet"]
 * @returns 公開URLパス（例: "/assets/imgs/notification/wallet.png"）または null
 *
 * @example
 * // ウォレット残高変更通知
 * resolveNotificationImage(["wallet-regular_coin-increment", "wallet-regular_coin", "wallet"])
 *
 * // 購入通知
 * resolveNotificationImage(["purchase-regular_coin", "purchase"])
 *
 * // ランクアップ通知
 * resolveNotificationImage(["rank_up"])
 */
export function resolveNotificationImage(
  candidates: string[],
): string | null {
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
