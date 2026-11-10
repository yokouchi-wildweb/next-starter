// src/features/core/messaging/components/common/InboxItemDetail/index.tsx
// 部品(props だけ): お知らせ 1 件の中身(画像・公開の日時・本文・リンク)。一覧の詳細と未読のモーダルが使う。
// 題は描かない(包む Modal の title が持つ)。画像は保存値のまま渡す(AppImage が storage:// の ref を表示用にする)

import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { AppImage } from "@/components/Media/AppImage";
import { Para } from "@/components/TextBlocks/Para";

import type { InboxItemDto } from "@/features/core/messaging/services/client/inboxClient";

import { formatInboxDate } from "../InboxItemRow";

export type InboxItemDetailProps = {
  item: Pick<InboxItemDto, "title" | "body" | "image" | "link" | "publishedAt">;
  /** リンクのボタンの文言(既定「詳しく見る」) */
  linkLabel?: string;
};

export function InboxItemDetail({ item, linkLabel = "詳しく見る" }: InboxItemDetailProps) {
  return (
    <Stack space={3}>
      {item.image ? (
        <AppImage
          src={item.image}
          alt={item.title ?? "お知らせの画像"}
          sizes="card"
          objectFit="contain"
          className="aspect-video w-full rounded-md bg-muted"
        />
      ) : null}
      <Para size="xs" tone="muted">
        {formatInboxDate(item.publishedAt)}
      </Para>
      <Para className="whitespace-pre-wrap break-words">{item.body}</Para>
      {item.link ? (
        <Flex justify="center">
          <LinkButton href={item.link} variant="outline">
            {linkLabel}
          </LinkButton>
        </Flex>
      ) : null}
    </Stack>
  );
}
