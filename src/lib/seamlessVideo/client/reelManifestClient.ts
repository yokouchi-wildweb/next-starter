// src/lib/seamlessVideo/client/reelManifestClient.ts
//
// 連結リールのマニフェストを保存する ClientService(HTTP は ClientService に集約)。

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type { ReelManifest } from "../manifest";

export const reelManifestClient = {
  /** マニフェストを保存する(上書き)。key 省略時は最新スロット、指定時は任意キーの名前空間。 */
  save: async (manifest: ReelManifest, key?: string): Promise<void> => {
    try {
      const url = key ? `/api/demo/seamless-av/manifest?key=${encodeURIComponent(key)}` : "/api/demo/seamless-av/manifest";
      await axios.post(url, manifest);
    } catch (error) {
      throw normalizeHttpError(error, "共有データの保存に失敗しました");
    }
  },
  /** 最新マニフェストを固定キーで保存する(後方互換)。 */
  saveLatest: async (manifest: ReelManifest): Promise<void> => {
    await reelManifestClient.save(manifest);
  },
};
