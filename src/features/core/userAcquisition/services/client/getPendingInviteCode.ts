// src/features/core/userAcquisition/services/client/getPendingInviteCode.ts

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

export type PendingInviteCodeResponse = {
  /** 招待リンク経由で cookie に保持されているコード。無ければ null */
  inviteCode: string | null;
};

/**
 * 招待リンク（?invite=CODE）由来の保留中招待コードを取得する。
 * サインアップフォームの招待コード欄プリフィルに使う。
 */
export async function getPendingInviteCode(): Promise<PendingInviteCodeResponse> {
  try {
    const { data } = await axios.get<PendingInviteCodeResponse>(
      "/api/acquisition/pending-invite-code",
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}
