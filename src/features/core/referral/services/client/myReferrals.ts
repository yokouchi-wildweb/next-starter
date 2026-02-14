// 自分が招待した人の一覧を取得するクライアントサービス

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";

export type MyReferralItem = {
  id: string;
  inviteeUserId: string;
  status: string;
  createdAt: string;
};

export type MyReferralsResponse = {
  referrals: MyReferralItem[];
};

/**
 * ログインユーザーが招待した人の一覧を取得
 */
export async function getMyReferrals(): Promise<MyReferralsResponse> {
  try {
    const { data } = await axios.get<MyReferralsResponse>("/api/referral/my-referrals");
    return data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}
