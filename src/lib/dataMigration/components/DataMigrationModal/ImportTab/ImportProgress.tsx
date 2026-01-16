// src/lib/dataMigration/components/DataMigrationModal/ImportTab/ImportProgress.tsx
// インポート進捗表示コンポーネント

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
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
              <p className="text-xs text-muted-foreground">ドメイン進捗</p>
              <p className="text-xs text-muted-foreground">
                {progress.currentDomainIndex} / {progress.totalDomains}
              </p>
            </Flex>
            <Block className="h-1.5 bg-muted rounded-full overflow-hidden">
              <Block
                className="h-full bg-primary/60 transition-all duration-300"
                style={{
                  width: `${((progress.currentDomainIndex || 1) / progress.totalDomains) * 100}%`,
                }}
              />
            </Block>
            <p className="text-xs text-muted-foreground mt-1">現在: {progress.currentDomain}</p>
          </Block>
        )}
        <Flex justify="between" align="center" className="mb-2">
          <p className="text-sm font-medium">インポート中...</p>
          <p className="text-sm text-muted-foreground">
            チャンク {progress.currentChunk} / {progress.totalChunks}
          </p>
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
        <p className="text-xs text-muted-foreground mt-2">処理中: {progress.currentChunkName}</p>
      </Block>
      <Block className="mt-3 p-3 bg-amber-500/10 rounded text-sm text-amber-700">
        インポート中はページを閉じないでください
      </Block>
    </Block>
  );
}
