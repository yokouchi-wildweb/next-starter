// src/lib/dataMigration/components/DataMigrationModal/ImportTab/ImportResult.tsx
// インポート結果表示コンポーネント

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import type { ImportResultData } from "../types";

export type ImportResultProps = {
  /** インポート結果 */
  result: ImportResultData;
};

/**
 * インポート結果表示コンポーネント
 */
export function ImportResult({ result }: ImportResultProps) {
  return (
    <Block className="mb-4">
      <Block
        className={`p-4 rounded-lg ${
          result.failedChunks === 0 ? "bg-emerald-500/10" : "bg-amber-500/10"
        }`}
      >
        <p className="font-medium mb-2">
          {result.failedChunks === 0 ? "インポート完了" : "インポート完了（一部エラー）"}
        </p>
        <Block className="text-sm flex flex-col gap-1">
          <p>インポートされたレコード: {result.totalRecords}件</p>
          <p>成功したチャンク: {result.successfulChunks}</p>
          {result.failedChunks > 0 && (
            <p className="text-destructive">失敗したチャンク: {result.failedChunks}</p>
          )}
        </Block>

        {/* 複数ドメインの場合はドメイン別結果を表示 */}
        {result.isMultiDomain && result.domainResults && (
          <Block className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">ドメイン別結果:</p>
            <Block className="flex flex-col gap-1 text-xs">
              {result.domainResults.map((dr) => (
                <Flex key={dr.domain} justify="between" className="text-muted-foreground">
                  <span>{dr.domain}</span>
                  <span>
                    {dr.totalRecords}件
                    {dr.failedChunks > 0 && (
                      <span className="text-destructive ml-1">
                        (エラー: {dr.failedChunks}チャンク)
                      </span>
                    )}
                  </span>
                </Flex>
              ))}
            </Block>
          </Block>
        )}
      </Block>

      {/* 失敗したチャンクの詳細 */}
      {result.chunkResults.some((c) => !c.success) && (
        <Block className="mt-3 p-3 bg-destructive/10 rounded text-sm">
          <p className="font-medium mb-1">エラー詳細:</p>
          {result.chunkResults
            .filter((c) => !c.success)
            .map((c) => (
              <p key={`${c.domain}-${c.chunkName}`} className="text-destructive">
                {result.isMultiDomain ? `[${c.domain}] ` : ""}
                {c.chunkName}: {c.error}
              </p>
            ))}
        </Block>
      )}
    </Block>
  );
}
