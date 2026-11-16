// src/features/core/messaging/components/common/AllowedKeysHint/index.tsx
// 部品(props だけ): 文言に使ってよい {{鍵}} の案内。unknownKeys があれば「使えない鍵」として出す
// (送る口は知らない鍵を含む欄をコードの値で送る。保存も同じ検査で止まる)

"use client";

import { SoftBadge } from "@/components/Badge";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

export type AllowedKeysHintProps = {
  /** 使ってよい鍵(vars は秘密を除く・共通の文脈・provides) */
  allowedKeys: readonly string[];
  /** 今の文の中の知らない鍵 */
  unknownKeys?: readonly string[];
  /** 見出しを出すか(既定 true) */
  showTitle?: boolean;
};

export function AllowedKeysHint({ allowedKeys, unknownKeys = [], showTitle = true }: AllowedKeysHintProps) {
  return (
    <Stack space={1} data-slot="allowed-keys-hint">
      {showTitle ? (
        <Span size="sm" tone="muted">
          使える変数(本文の中に {"{{変数名}}"} と書きます)
        </Span>
      ) : null}
      {allowedKeys.length > 0 ? (
        <Flex gap="xs" wrap="wrap">
          {allowedKeys.map((key) => (
            <SoftBadge key={key} variant="outline" size="sm" className="font-mono">
              {`{{${key}}}`}
            </SoftBadge>
          ))}
        </Flex>
      ) : (
        <Span size="sm" tone="muted">
          この通知で使える変数はありません
        </Span>
      )}
      {unknownKeys.length > 0 ? (
        <Flex align="center" gap="xs" wrap="wrap">
          <Span size="sm" tone="destructive">
            使えない変数:
          </Span>
          {unknownKeys.map((key) => (
            <SoftBadge key={key} variant="destructive" size="sm" className="font-mono">
              {`{{${key}}}`}
            </SoftBadge>
          ))}
        </Flex>
      ) : null}
    </Stack>
  );
}
