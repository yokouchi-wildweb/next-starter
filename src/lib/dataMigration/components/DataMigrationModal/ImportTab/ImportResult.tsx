// src/lib/dataMigration/components/DataMigrationModal/ImportTab/ImportResult.tsx
// インポート結果表示コンポーネント

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import type { ImportResultData } from "../types";

export type ImportResultProps = {
  /** インポート結果 */
  result: ImportResultData;
};

/**
 * インポート結果表示コンポーネント
 */
export function ImportResult({ result }: ImportResultProps) {
  // 最初に失敗したチャンクで全体を止める（前のチャンクは DB に入っている。後のチャンクは流していない）
  const failed = result.failedChunks > 0;
  const notRunChunks = result.notRunChunks ?? [];
  const label = (domain: string, chunkName: string) => (result.isMultiDomain ? `[${domain}] ${chunkName}` : chunkName);

  return (
    <Block className="mb-4">
      <Block className={`p-4 rounded-lg ${failed ? "bg-destructive/10" : "bg-success/10"}`}>
        <Para size="inherit" weight="medium" tone={failed ? "destructive" : "inherit"} align="inherit" className="mt-0 mb-2">
          {failed ? "インポート失敗（途中で停止）" : "インポート完了"}
        </Para>
        <Block className="text-sm flex flex-col gap-1">
          {failed ? (
            <>
              <Para size="inherit" weight="inherit" align="inherit" className="my-0">
                DB に入ったもの: {result.successfulChunks}チャンク・{result.totalRecords}件
                {result.successfulChunks > 0 && "（取り消されません）"}
              </Para>
              <Para size="inherit" weight="inherit" tone="destructive" align="inherit" className="my-0">
                入っていないもの: 失敗した {result.failedChunks}チャンク
                {notRunChunks.length > 0 && ` + 流さなかった ${notRunChunks.length}チャンク`}
              </Para>
              <Para size="inherit" weight="inherit" tone="muted" align="inherit" className="my-0">
                原因を直して同じファイルを取り込み直すと、入ったチャンクは上書きされ、残りが続けて入ります。
              </Para>
            </>
          ) : (
            <>
              <Para size="inherit" weight="inherit" align="inherit" className="my-0">インポートされたレコード: {result.totalRecords}件</Para>
              <Para size="inherit" weight="inherit" align="inherit" className="my-0">成功したチャンク: {result.successfulChunks}</Para>
            </>
          )}
        </Block>

        {/* 複数ドメインの場合はドメイン別結果を表示 */}
        {result.isMultiDomain && result.domainResults && (
          <Block className="mt-3 pt-3 border-t border-border">
            <Para size="xs" weight="inherit" tone="muted" align="inherit" className="mt-0 mb-2">ドメイン別結果:</Para>
            <Block className="flex flex-col gap-1 text-xs">
              {result.domainResults.map((dr) => (
                <Flex key={dr.domain} justify="between" className="text-muted-foreground">
                  <Span inline>{dr.domain}</Span>
                  <Span inline>
                    {dr.totalRecords}件
                    {dr.failedChunks > 0 && (
                      <Span inline tone="destructive" className="ml-1">
                        (エラー: {dr.failedChunks}チャンク)
                      </Span>
                    )}
                  </Span>
                </Flex>
              ))}
            </Block>
          </Block>
        )}
      </Block>

      {/* 失敗したチャンクの詳細 */}
      {result.chunkResults.some((c) => !c.success) && (
        <Block className="mt-3 p-3 bg-destructive/10 rounded text-sm">
          <Para size="inherit" weight="medium" align="inherit" className="mt-0 mb-1">エラー詳細:</Para>
          {result.chunkResults
            .filter((c) => !c.success)
            .map((c) => (
              <Para key={`${c.domain}-${c.chunkName}`} size="inherit" weight="inherit" tone="destructive" align="inherit" className="my-0">
                {label(c.domain, c.chunkName)}: {c.error}
              </Para>
            ))}
        </Block>
      )}

      {/* 止まったために流さなかったチャンク */}
      {notRunChunks.length > 0 && (
        <Block className="mt-3 p-3 bg-muted rounded text-sm">
          <Para size="inherit" weight="medium" align="inherit" className="mt-0 mb-1">流さなかったチャンク（DB に入っていません）:</Para>
          <Para size="inherit" weight="inherit" tone="muted" align="inherit" className="my-0">
            {notRunChunks.map((c) => label(c.domain, c.chunkName)).join("、")}
          </Para>
        </Block>
      )}
    </Block>
  );
}
