// 招待コード関連のクライアントサービス

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";

// レスポンス型
export type InviteCodeData = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currentTotalUses: number;
  maxTotalUses: number | null;
  createdAt: string;
};

export type GetMyInviteCodeResponse = {
  inviteCode: InviteCodeData | null;
};

export type IssueMyInviteCodeResponse = {
  inviteCode: InviteCodeData;
};

/**
 * 自分の招待コードを取得（発行しない）
 */
export async function getMyInviteCode(): Promise<GetMyInviteCodeResponse> {
  try {
    const res = await axios.get<GetMyInviteCodeResponse>("/api/coupon/my-invite");
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

/**
 * 自分の招待コードを取得（なければ発行）
 */
export async function issueMyInviteCode(): Promise<IssueMyInviteCodeResponse> {
  try {
    const res = await axios.post<IssueMyInviteCodeResponse>("/api/coupon/my-invite");
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}
