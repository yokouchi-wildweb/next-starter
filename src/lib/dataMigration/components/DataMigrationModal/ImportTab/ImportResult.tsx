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
  // 最初に失敗したチャンクで全体を止める（前のチャンクは DB に入っている。後のチャンクは流していない）
  const failed = result.failedChunks > 0;
  const notRunChunks = result.notRunChunks ?? [];
  const label = (domain: string, chunkName: string) => (result.isMultiDomain ? `[${domain}] ${chunkName}` : chunkName);

  return (
    <Block className="mb-4">
      <Block className={`p-4 rounded-lg ${failed ? "bg-destructive/10" : "bg-success/10"}`}>
        <p className={`font-medium mb-2 ${failed ? "text-destructive-text" : ""}`}>
          {failed ? "インポート失敗（途中で停止）" : "インポート完了"}
        </p>
        <Block className="text-sm flex flex-col gap-1">
          {failed ? (
            <>
              <p>
                DB に入ったもの: {result.successfulChunks}チャンク・{result.totalRecords}件
                {result.successfulChunks > 0 && "（取り消されません）"}
              </p>
              <p className="text-destructive-text">
                入っていないもの: 失敗した {result.failedChunks}チャンク
                {notRunChunks.length > 0 && ` + 流さなかった ${notRunChunks.length}チャンク`}
              </p>
              <p className="text-muted-foreground">
                原因を直して同じファイルを取り込み直すと、入ったチャンクは上書きされ、残りが続けて入ります。
              </p>
            </>
          ) : (
            <>
              <p>インポートされたレコード: {result.totalRecords}件</p>
              <p>成功したチャンク: {result.successfulChunks}</p>
            </>
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
                      <span className="text-destructive-text ml-1">
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
              <p key={`${c.domain}-${c.chunkName}`} className="text-destructive-text">
                {label(c.domain, c.chunkName)}: {c.error}
              </p>
            ))}
        </Block>
      )}

      {/* 止まったために流さなかったチャンク */}
      {notRunChunks.length > 0 && (
        <Block className="mt-3 p-3 bg-muted rounded text-sm">
          <p className="font-medium mb-1">流さなかったチャンク（DB に入っていません）:</p>
          <p className="text-muted-foreground">
            {notRunChunks.map((c) => label(c.domain, c.chunkName)).join("、")}
          </p>
        </Block>
      )}
    </Block>
  );
}
