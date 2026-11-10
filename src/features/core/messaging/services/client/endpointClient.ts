"use client";

// src/features/core/messaging/services/client/endpointClient.ts
//
// 本人の端末の帳簿の API(/api/me/messaging/endpoints)。

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type {
  MessageEndpointDto,
  RegisterMessageEndpointInput,
} from "@/features/core/messaging/services/server/endpoints/schema";

const BASE = "/api/me/messaging/endpoints";

export type { MessageEndpointDto, RegisterMessageEndpointInput };

/** 本人の宛先の一覧 */
export async function listMessageEndpoints(): Promise<MessageEndpointDto[]> {
  try {
    const res = await axios.get<{ endpoints: MessageEndpointDto[] }>(BASE);
    return res.data.endpoints;
  } catch (error) {
    throw normalizeHttpError(error, "端末の一覧の取得に失敗しました");
  }
}

/** 宛先を登録する(同じ宛先は更新して有効に戻す。他人の宛先は 409) */
export async function registerMessageEndpoint(input: RegisterMessageEndpointInput): Promise<MessageEndpointDto> {
  try {
    const res = await axios.post<{ endpoint: MessageEndpointDto }>(BASE, input);
    return res.data.endpoint;
  } catch (error) {
    throw normalizeHttpError(error, "端末の登録に失敗しました");
  }
}

/** 本人の宛先を消す */
export async function removeMessageEndpoint(id: string): Promise<void> {
  try {
    await axios.delete(BASE, { params: { id } });
  } catch (error) {
    throw normalizeHttpError(error, "端末の登録の削除に失敗しました");
  }
}
