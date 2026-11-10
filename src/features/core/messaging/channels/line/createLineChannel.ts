// src/features/core/messaging/channels/line/createLineChannel.ts
//
// LINE の経路の項目を部品から作る(本物の部品は index.ts、テストは偽物を渡す)。
// - 入切: enabled(messaging の config channels.line.enabled、既定 切)。切の時は送る口が channel_off にする
// - 宛先: user_line_profiles.line_user_id(LINE の連携の機能 userLineProfile が閉じていれば宛先なし)
// - 送信: lib/line の push(テキスト)。lib/line は状態を誤りの文にしか載せないので文から読む:
//   429・5xx → transient / その他の 4xx → permanent / 応答なし → unknown。provider の冪等の鍵(X-Line-Retry-Key)はまだ送れない

import { lineFieldsSchema, type ChannelAddress, type ChannelSendResult, type MessageChannel } from "@/lib/messaging";

export type LineChannelDeps = {
  enabled: boolean;
  findLineUserIds: (userIds: readonly string[]) => Promise<ChannelAddress[]>;
  push: (to: string, text: string) => Promise<unknown>;
};

const STATUS_PATTERN = /LINE Messaging API エラー: (\d{3})/;

/** lib/line の誤りから失敗の分類を決める */
export function classifyLineError(error: unknown): { kind: "transient" | "permanent" | "unknown"; reason: string } {
  const message = error instanceof Error ? error.message : String(error);
  const match = STATUS_PATTERN.exec(message);
  if (!match) return { kind: "unknown", reason: "line_no_response" };
  const status = Number(match[1]);
  if (status === 429 || status >= 500) return { kind: "transient", reason: `http_${status}` };
  return { kind: "permanent", reason: `http_${status}` };
}

export function createLineChannel(deps: LineChannelDeps): MessageChannel {
  return {
    key: "line",
    label: "LINE",
    addressing: "user",
    enabled: deps.enabled,
    fields: lineFieldsSchema,
    resolveAddresses: (userIds) => deps.findLineUserIds(userIds),
    async send(targets) {
      const results: ChannelSendResult[] = [];
      for (const target of targets) {
        const text = String((target.content as { text?: unknown }).text ?? "");
        try {
          await deps.push(target.address, text);
          results.push({ address: target.address, kind: "sent", provider: "line", providerMessageId: null });
        } catch (error) {
          const { kind, reason } = classifyLineError(error);
          results.push({
            address: target.address,
            kind,
            reason,
            message: error instanceof Error ? error.message : String(error),
            provider: "line",
          });
        }
      }
      return results;
    },
  };
}
