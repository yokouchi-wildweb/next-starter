// src/lib/seamlessVideo/client/reelManifestClient.ts
//
// 連結リールのマニフェストを保存する ClientService(HTTP は ClientService に集約)。

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type { ReelManifest } from "../manifest";

export const reelManifestClient = {
  /** 最新マニフェストを固定キーで保存する(上書き)。 */
  saveLatest: async (manifest: ReelManifest): Promise<void> => {
    try {
      await axios.post("/api/demo/seamless-av/manifest", manifest);
    } catch (error) {
      throw normalizeHttpError(error, "共有データの保存に失敗しました");
    }
  },
};
