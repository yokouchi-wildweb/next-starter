// src/features/core/user/services/client/phoneNumberClient.ts
// 本人の電話番号を SMS 認証なしで書く(PATCH /api/me/phone)。受け付けるのは一覧に phone があり SMS 認証が閉のときだけ(それ以外は 404)

"use client";

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/me/phone";

export type UpdateMyPhoneNumberInput = {
  /** E.164(例 +819012345678)。null で消す */
  phoneNumber: string | null;
};

export type UpdateMyPhoneNumberResponse = {
  phoneNumber: string | null;
  phoneVerifiedAt: string | null;
};

export async function updateMyPhoneNumber(input: UpdateMyPhoneNumberInput): Promise<UpdateMyPhoneNumberResponse> {
  try {
    const response = await axios.patch<UpdateMyPhoneNumberResponse>(ENDPOINT, input);
    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "電話番号の保存に失敗しました");
  }
}
