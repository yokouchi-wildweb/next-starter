// src/features/core/auth/services/client/phoneVerification.ts

"use client";

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";

const CHECK_ENDPOINT = "/api/auth/phone/check";
const VERIFY_ENDPOINT = "/api/auth/phone/verify";

export type CheckPhonePayload = {
  phoneNumber: string;
};

export type CheckPhoneResponse = {
  available: boolean;
  phoneNumber: string;
};

export type VerifyPhonePayload = {
  phoneNumber: string;
  idToken: string;
};

export type VerifyPhoneResponse = {
  phoneNumber: string;
  phoneVerifiedAt: string;
};

/**
 * 電話番号が使用可能かどうかをチェックする
 */
export async function checkPhoneAvailability(
  payload: CheckPhonePayload
): Promise<CheckPhoneResponse> {
  try {
    const response = await axios.post<CheckPhoneResponse>(CHECK_ENDPOINT, payload);
    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "電話番号のチェックに失敗しました");
  }
}

/**
 * 電話番号検証を完了し、DBを更新する
 */
export async function verifyPhone(
  payload: VerifyPhonePayload
): Promise<VerifyPhoneResponse> {
  try {
    const response = await axios.post<VerifyPhoneResponse>(VERIFY_ENDPOINT, payload);
    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "電話番号の検証に失敗しました");
  }
}
