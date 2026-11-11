"use client";

// src/features/core/messaging/services/client/preferenceClient.ts
//
// 本人の連絡の好み(種類 × 経路の配信停止)の API(/api/me/messaging/preferences)。門 messagingPreferences が閉なら 404

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type {
  MessagePreferenceCategoryDto,
  MessagePreferenceCellDto,
  MessagePreferenceChannelDto,
  MessagePreferencesDto,
  MessagePreferenceVia,
  SetMessagePreferenceInput,
} from "@/features/core/messaging/services/server/preferences/dto";

import { MESSAGE_PREFERENCES_API_PATH } from "../../constants/preferences";

export type {
  MessagePreferenceCategoryDto,
  MessagePreferenceCellDto,
  MessagePreferenceChannelDto,
  MessagePreferencesDto,
  MessagePreferenceVia,
  SetMessagePreferenceInput,
};

/** 本人の好みの表 */
export async function getMessagePreferences(): Promise<MessagePreferencesDto> {
  try {
    const res = await axios.get<{ preferences: MessagePreferencesDto }>(MESSAGE_PREFERENCES_API_PATH);
    return res.data.preferences;
  } catch (error) {
    throw normalizeHttpError(error, "通知の設定の取得に失敗しました");
  }
}

/** 1 マス(種類・経路)か全体(どちらも '*')を止める / 再開する。変えた後の表を返す */
export async function setMessagePreference(input: SetMessagePreferenceInput): Promise<MessagePreferencesDto> {
  try {
    const res = await axios.patch<{ preferences: MessagePreferencesDto }>(MESSAGE_PREFERENCES_API_PATH, input);
    return res.data.preferences;
  } catch (error) {
    throw normalizeHttpError(error, "通知の設定を変えられませんでした");
  }
}
