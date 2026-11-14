// src/features/core/messaging/components/Unsubscribe/index.tsx
// セクションコンテナ(配信停止の確認のページ /unsubscribe の中身)。loader が確かめたトークンの結果を props で受け、
// 正しくなければ結果(invalid)、正しければ確認 → hook useUnsubscribe の submit(API の POST)→ 結果(done)を並べる。
// 下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { err } from "@/lib/errors";

import { UnsubscribeConfirm } from "@/features/core/messaging/components/UnsubscribeConfirm";
import { UnsubscribeResult } from "@/features/core/messaging/components/UnsubscribeResult";
import { useUnsubscribe } from "@/features/core/messaging/hooks/useUnsubscribe";

export type UnsubscribeProps =
  | { valid: false }
  | {
      valid: true;
      token: string;
      categoryLabel: string;
      channelLabel: string;
    };

export function Unsubscribe(props: UnsubscribeProps) {
  if (!props.valid) return <UnsubscribeResult status="invalid" />;
  return <UnsubscribeValid {...props} />;
}

function UnsubscribeValid({ token, categoryLabel, channelLabel }: Extract<UnsubscribeProps, { valid: true }>) {
  const { submit, status, isSubmitting, error } = useUnsubscribe(token);
  if (status === "done") return <UnsubscribeResult status="done" categoryLabel={categoryLabel} />;
  return (
    <UnsubscribeConfirm
      categoryLabel={categoryLabel}
      channelLabel={channelLabel}
      onConfirm={() => void submit()}
      pending={isSubmitting}
      errorText={error ? err(error, "配信を停止できませんでした") : null}
    />
  );
}
