import axios from "axios";
import type { CardWithNames } from "@/features/card/entities";
import { normalizeHttpError } from "@/lib/errors";

// クライアント側からガチャAPIを呼び出すためのラッパー

export const gachaClient = {
  /**
   * count 回分のガチャをサーバーへリクエストする
   */
  draw: async (count: number): Promise<CardWithNames[]> => {
    try {
      const response = await axios.post<CardWithNames[]>("/api/gacha/draw", { count });
      return response.data;
    } catch (error) {
      throw normalizeHttpError(error, "ガチャの抽選に失敗しました");
    }
  },
};
