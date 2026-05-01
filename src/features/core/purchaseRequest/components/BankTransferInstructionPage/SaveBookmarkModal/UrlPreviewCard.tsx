// src/features/core/purchaseRequest/components/BankTransferInstructionPage/SaveBookmarkModal/UrlPreviewCard.tsx
//
// 保存対象ページの URL プレビューカード。
// ページタイトル + URL の中央プレビュー + URL コピー操作をまとめる。
// モーダル冒頭で「何を保存するのか」を一目で確認できるようにする目的。

"use client";

import { useState } from "react";
import { Check, Copy, Link as LinkIcon } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks";
import { useToast } from "@/lib/toast";

type Props = {
  /** 保存対象のページタイトル */
  title: string;
  /** 保存対象の URL（絶対 URL） */
  url: string;
};

export function UrlPreviewCard({ title, url }: Props) {
  const { showToast } = useToast();
  // コピー直後の視覚フィードバック（チェックマーク + ラベル切替）の表示制御
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast("URL をコピーしました", "success");
      // 2 秒後に元のラベルに戻す
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("コピーに失敗しました", "error");
    }
  };

  return (
    <Block padding="sm" className="rounded-lg border border-border bg-primary/5">
      <Stack space={2}>
        <Flex align="center" gap="xs">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LinkIcon className="h-4 w-4" aria-hidden />
          </span>
          <Span weight="semiBold" size="sm" className="truncate">
            {title}
          </Span>
        </Flex>

        <Block paddingInline="xs" className="rounded-md bg-card border border-border">
          <Flex align="center" gap="xs" className="py-2 px-2">
            <Span size="xs" tone="muted" className="flex-1 truncate font-mono">
              {url}
            </Span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="URL をコピー"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent/30 active:bg-accent/50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  コピー済み
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  コピー
                </>
              )}
            </button>
          </Flex>
        </Block>
      </Stack>
    </Block>
  );
}
