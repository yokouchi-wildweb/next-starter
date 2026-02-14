// 管理者用: 指定ユーザーの紹介一覧を取得するクライアントサービス

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";

export type ReferralByInviterItem = {
  id: string;
  inviteeUserId: string;
  status: string;
  createdAt: string;
};

export type ReferralsByInviterResponse = {
  referrals: ReferralByInviterItem[];
};

/**
 * 管理者用: 指定ユーザーの紹介一覧を取得
 */
export async function getReferralsByInviter(userId: string): Promise<ReferralsByInviterResponse> {
  try {
    const { data } = await axios.get<ReferralsByInviterResponse>(
      `/api/admin/referral/by-inviter/${userId}`,
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}
