"use client";

// src/domains/core/messaging/hooks/useSendTest.ts
//
// 自分へのテスト送信(公開の部品、D191): 渡した口(自由連絡・一括・定義連絡のテスト)へ、毎回新しい二重送信の鍵を付けて送る。
// 送った後は送信の一覧を再検証する(テストの送信も一覧に出る)。誤りは投げる(呼び手が知らせる)

import { useCallback } from "react";

import { useDomainMutation } from "@/lib/crud";

import { newIdempotencyKey } from "./idempotencyKey";
import { ADMIN_DISPATCHES_KEY, adminSendActionKey } from "./messagingKeys";

export type UseSendTestOptions<Input, Result> = {
  /** 送る口(例: sendAdminTestMessage・sendAdminDefinitionTest)。input に idempotencyKey が付いて来る */
  fetcher: (input: Input & { idempotencyKey: string }) => Promise<Result>;
  /** mutation の鍵の名(既定 "test") */
  name?: string;
};

export function useSendTest<Input, Result>({ fetcher, name = "test" }: UseSendTestOptions<Input, Result>) {
  const mutation = useDomainMutation<Result, Input & { idempotencyKey: string }>(adminSendActionKey(name), fetcher, [ADMIN_DISPATCHES_KEY]);
  const { trigger } = mutation;
  const run = useCallback((input: Input) => trigger({ ...input, idempotencyKey: newIdempotencyKey() }), [trigger]);
  return { run, isTesting: mutation.isMutating };
}
