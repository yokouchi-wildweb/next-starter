// src/features/core/purchaseRequest/components/BankTransferInstructionPage/SaveBookmarkModal/index.tsx
//
// 「この画面を保存」モーダルの本体。
//
// 構成:
//   1. URL プレビューカード（タイトル + URL + コピーボタン）
//   2. 共有アクションリスト
//      - メールで送る（mailto）
//      - その他で共有（navigator.share）/ 利用不可端末では URL コピーにフォールバック
//   3. ブックマーク案内（1 行のヒント）
//
// 振込完了後にユーザーがこの画面に再訪して「振込完了を申告する」を押せるよう、
// URL を確実に手元に保管してもらうための導線を集約する。
//
// LINE 等の個別アプリへの送信は、navigator.share の OS 共有シートに任せる。
// シート側にインストール済みの送信先（LINE/メール/コピー 等）が揃うため二重に出さない。

"use client";

import { Mail, Share2 } from "lucide-react";

import Modal from "@/components/Overlays/Modal";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para, Span } from "@/components/TextBlocks";
import { useToast } from "@/lib/toast";

import { ActionRow } from "./ActionRow";
import { UrlPreviewCard } from "./UrlPreviewCard";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 保存対象ページのタイトル（共有メッセージにも使う） */
  title: string;
  /** 保存対象の URL（絶対 URL） */
  url: string;
};

// メール件名・本文のテンプレート（保管目的なので平易な文言で固定）
function buildMailto(title: string, url: string): string {
  const subject = encodeURIComponent(`【保管用】${title}`);
  const body = encodeURIComponent(
    `${title}のページです。\nお振込み後の手続きにこの URL からアクセスしてください:\n\n${url}\n`,
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

export function SaveBookmarkModal({ open, onOpenChange, title, url }: Props) {
  const { showToast } = useToast();
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleEmail = () => {
    // mailto は同一タブ遷移で OS のメーラーが起動する
    window.location.href = buildMailto(title, url);
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // ユーザーキャンセル等は無視
    }
  };

  const handleFallbackCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("URL をコピーしました", "success");
    } catch {
      showToast("コピーに失敗しました", "error");
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="この画面を保存"
      maxWidth={520}
      className="p-4 gap-4"
    >
      <Stack space={4}>
        <UrlPreviewCard title={title} url={url} />

        <Stack space={2}>
          <Span size="xs" weight="semiBold" tone="muted">
            共有して保存
          </Span>
          <Stack space={2}>
            <ActionRow
              icon={<Mail className="h-5 w-5" />}
              iconAccent="bg-sky-500/10 text-sky-600"
              label="メールで送る"
              description="メールを自分宛てに送付して保管できます"
              onClick={handleEmail}
            />
            {canNativeShare ? (
              <ActionRow
                icon={<Share2 className="h-5 w-5" />}
                iconAccent="bg-primary/10 text-primary"
                label="その他で共有"
                description="LINEなどの送信先を共有シートで選べます"
                onClick={handleNativeShare}
              />
            ) : (
              <ActionRow
                icon={<Share2 className="h-5 w-5" />}
                iconAccent="bg-primary/10 text-primary"
                label="URL をコピー"
                description="他のアプリに自由に貼り付けて共有できます"
                onClick={handleFallbackCopy}
              />
            )}
          </Stack>
        </Stack>

        <Block className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <Flex align="center" gap="xs">
            <Para size="xs" tone="muted" className="my-0">
              このページをブックマークに登録しておくと、いつでも閲覧できます。
            </Para>
          </Flex>
        </Block>
      </Stack>
    </Modal>
  );
}
