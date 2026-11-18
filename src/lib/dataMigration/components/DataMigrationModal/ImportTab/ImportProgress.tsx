// src/lib/dataMigration/components/DataMigrationModal/ImportTab/ImportProgress.tsx
// インポート進捗表示コンポーネント

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";
import type { ImportProgress as ImportProgressType } from "../types";

export type ImportProgressProps = {
  /** 進捗状態 */
  progress: ImportProgressType;
};

/**
 * インポート進捗表示コンポーネント
 */
export function ImportProgress({ progress }: ImportProgressProps) {
  return (
    <Block className="mb-4">
      <Block className="p-4 bg-primary/5 rounded-lg">
        {/* 複数ドメインの場合はドメイン進捗を表示 */}
        {progress.totalDomains && progress.totalDomains > 1 && (
          <Block className="mb-3 pb-3 border-b border-border">
            <Flex justify="between" align="center" className="mb-1">
              <Para size="xs" weight="inherit" tone="muted" align="inherit" className="my-0">ドメイン進捗</Para>
              <Para size="xs" weight="inherit" tone="muted" align="inherit" className="my-0">
                {progress.currentDomainIndex} / {progress.totalDomains}
              </Para>
            </Flex>
            <Block className="h-1.5 bg-muted rounded-full overflow-hidden">
              <Block
                className="h-full bg-primary/60 transition-all duration-300"
                style={{
                  width: `${((progress.currentDomainIndex || 1) / progress.totalDomains) * 100}%`,
                }}
              />
            </Block>
            <Para size="xs" weight="inherit" tone="muted" align="inherit" className="mt-1 mb-0">現在: {progress.currentDomain}</Para>
          </Block>
        )}
        <Flex justify="between" align="center" className="mb-2">
          <Para size="sm" weight="medium" align="inherit" className="my-0">インポート中...</Para>
          <Para size="sm" weight="inherit" tone="muted" align="inherit" className="my-0">
            チャンク {progress.currentChunk} / {progress.totalChunks}
          </Para>
        </Flex>
        {/* チャンク進捗バー */}
        <Block className="h-2 bg-muted rounded-full overflow-hidden">
          <Block
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${(progress.currentChunk / progress.totalChunks) * 100}%`,
            }}
          />
        </Block>
        <Para size="xs" weight="inherit" tone="muted" align="inherit" className="mt-2 mb-0">処理中: {progress.currentChunkName}</Para>
      </Block>
      <Block className="mt-3 p-3 bg-warning/10 rounded text-sm text-warning-text">
        インポート中はページを閉じないでください
      </Block>
    </Block>
  );
}
