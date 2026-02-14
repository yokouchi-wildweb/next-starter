// 自分の紹介元を取得するクライアントサービス

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";

export type MyReferrerResponse = {
  referral: {
    id: string;
    inviterUserId: string;
    status: string;
    createdAt: string;
  } | null;
};

/**
 * ログインユーザーの紹介元を取得
 */
export async function getMyReferrer(): Promise<MyReferrerResponse> {
  try {
    const { data } = await axios.get<MyReferrerResponse>("/api/referral/my-referrer");
    return data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}
