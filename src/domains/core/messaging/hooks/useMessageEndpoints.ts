"use client";

// src/domains/core/messaging/hooks/useMessageEndpoints.ts
//
// 本人の端末の帳簿(一覧・登録・削除)。宛先(プッシュのトークンなど)を渡して登録するだけで、
// 通知の許可・Service Worker・ネイティブの SDK は fork が持つ(D45)。

import useSWR from "swr";

import { useDomainMutation } from "@/lib/crud";

import {
  listMessageEndpoints,
  registerMessageEndpoint,
  removeMessageEndpoint,
  type MessageEndpointDto,
  type RegisterMessageEndpointInput,
} from "../services/client/endpointClient";
import { MESSAGE_ENDPOINTS_KEY, MESSAGE_ENDPOINTS_REGISTER_KEY, MESSAGE_ENDPOINTS_REMOVE_KEY } from "./messagingKeys";

/** SWR のキー(mutation はこのプレフィックスで一覧を再検証する) */

export function useMessageEndpoints() {
  const list = useSWR<MessageEndpointDto[]>(MESSAGE_ENDPOINTS_KEY, () => listMessageEndpoints());
  const register = useDomainMutation<MessageEndpointDto, RegisterMessageEndpointInput>(
    MESSAGE_ENDPOINTS_REGISTER_KEY,
    (input) => registerMessageEndpoint(input),
    MESSAGE_ENDPOINTS_KEY,
  );
  const remove = useDomainMutation<void, string>(
    MESSAGE_ENDPOINTS_REMOVE_KEY,
    (id) => removeMessageEndpoint(id),
    MESSAGE_ENDPOINTS_KEY,
  );
  return {
    endpoints: list.data ?? [],
    isLoading: list.isLoading,
    error: list.error,
    /** 宛先を登録する(例 { channel: "push", address: token, kind: "web" }) */
    register: register.trigger,
    isRegistering: register.isMutating,
    /** 本人の宛先を消す */
    remove: remove.trigger,
    isRemoving: remove.isMutating,
  };
}
