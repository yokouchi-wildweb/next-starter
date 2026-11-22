"use client";

// src/domains/core/messaging/hooks/useSendPreview.ts
//
// 「あなた宛ての表示例」(公開の部品、D191): 渡した口(自由連絡・一括・定義連絡のプレビュー)で描いた表示例を持つ。
// run(input) が描いて持ち、close で消す。誤りは投げる(呼び手が知らせる)。入力を変えたら呼び手が close で古い表示例を消す

import { useCallback, useState } from "react";

import { useDomainMutation } from "@/lib/crud";
import { adminSendActionKey } from "./messagingKeys";

export type UseSendPreviewOptions<Input, Preview> = {
  /** 描く口(例: previewAdminMessage・previewAdminDefinition) */
  fetcher: (input: Input) => Promise<Preview>;
  /** mutation の鍵の名(1 画面に 2 つ置く時に分ける。既定 "preview") */
  name?: string;
};

export function useSendPreview<Input, Preview>({ fetcher, name = "preview" }: UseSendPreviewOptions<Input, Preview>) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const mutation = useDomainMutation<Preview, Input>(adminSendActionKey(name), fetcher);
  const { trigger } = mutation;

  const run = useCallback(
    async (input: Input) => {
      const next = await trigger(input);
      setPreview(next);
      return next;
    },
    [trigger],
  );
  const close = useCallback(() => setPreview(null), []);

  return { preview, run, close, isPreviewing: mutation.isMutating };
}
