"use client";

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/activity/dau";

/**
 * DAUアクティビティを記録する
 * クライアント側から1日1回だけ呼び出される想定
 */
export async function recordDau(): Promise<void> {
  try {
    await axios.post(ENDPOINT);
  } catch (error) {
    throw normalizeHttpError(error, "DAU記録に失敗しました");
  }
}
