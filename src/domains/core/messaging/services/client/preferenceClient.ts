"use client";

// src/domains/core/messaging/services/client/preferenceClient.ts
//
// 本人の連絡の好み(配信停止。送信チャンネル > 種別の枠 > グループ > カテゴリーの入れ子)の API(/api/me/messaging/preferences)。門 messagingPreferences が閉なら 404

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type {
  MessagePreferenceCategoryDto,
  MessagePreferenceCategoryStopDto,
  MessagePreferenceChannelDto,
  MessagePreferenceGroupDto,
  MessagePreferenceGroupStopDto,
  MessagePreferenceKindDto,
  MessagePreferenceKindFrameDto,
  MessagePreferencesDto,
  MessagePreferenceVia,
  SetMessagePreferenceInput,
} from "@/domains/core/messaging/services/server/preferences/dto";

import { MESSAGE_PREFERENCES_API_PATH } from "../../constants/preferences";

export type {
  MessagePreferenceCategoryDto,
  MessagePreferenceCategoryStopDto,
  MessagePreferenceChannelDto,
  MessagePreferenceGroupDto,
  MessagePreferenceGroupStopDto,
  MessagePreferenceKindDto,
  MessagePreferenceKindFrameDto,
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

/** 1 マス(カテゴリー・送信チャンネル)・全体(どちらも '*')・種別まるごと({ kind })を止める / 再開する。変えた後の表を返す */
export async function setMessagePreference(input: SetMessagePreferenceInput): Promise<MessagePreferencesDto> {
  try {
    const res = await axios.patch<{ preferences: MessagePreferencesDto }>(MESSAGE_PREFERENCES_API_PATH, input);
    return res.data.preferences;
  } catch (error) {
    throw normalizeHttpError(error, "通知の設定を変えられませんでした");
  }
}
