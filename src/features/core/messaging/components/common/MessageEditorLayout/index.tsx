// src/features/core/messaging/components/common/MessageEditorLayout/index.tsx
// 部品(props だけ): 連絡の編集の 2 つの欄(D80)。左 = プレビュー、右 = 入力(経路ごとのタブ)。
// 狭い画面は入力が上、プレビューがその下。タブの値は呼び手が持つ(activeChannel / onChannelChange)

"use client";

import type { ReactNode } from "react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { StateTabs, StateTabsContent } from "@/components/Navigation/StateTabs";
import { Span } from "@/components/TextBlocks/Span";

export type MessageEditorLayoutProps = {
  channels: readonly { key: string; label: string }[];
  activeChannel: string;
  onChannelChange: (channel: string) => void;
  /** 左のプレビュー(今のタブの経路) */
  preview: ReactNode;
  /** 右の入力(今のタブの経路の欄) */
  children: ReactNode;
};

export function MessageEditorLayout({ channels, activeChannel, onChannelChange, preview, children }: MessageEditorLayoutProps) {
  return (
    <Flex direction="column" gap="md" className="md:flex-row-reverse md:items-start" data-slot="message-editor-layout">
      <Block className="min-w-0 md:w-1/2">
        <StateTabs
          tabs={channels.map((channel) => ({ value: channel.key, label: channel.label }))}
          value={activeChannel}
          onValueChange={onChannelChange}
          ariaLabel="送信方法"
          size="sm"
        >
          <StateTabsContent value={activeChannel} className="pt-3">
            {children}
          </StateTabsContent>
        </StateTabs>
      </Block>
      <Stack space={2} className="min-w-0 md:sticky md:top-0 md:w-1/2">
        <Span size="sm" weight="semiBold">
          プレビュー
        </Span>
        {preview}
      </Stack>
    </Flex>
  );
}
