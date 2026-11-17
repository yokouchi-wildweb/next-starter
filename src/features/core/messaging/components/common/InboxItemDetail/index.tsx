// src/features/core/messaging/components/common/InboxItemDetail/index.tsx
// 部品(props だけ): お知らせ 1 件の中身(公開の日時 + InboxLayoutView)。一覧の詳細と未読のモーダルが使う。
// - mode detail(既定)= 描き方の 3 段(ひな形のお知らせの描き方 > 汎用 > 要約のカード)。中身は詳しい表示(useInboxItemDetail)を渡す
//   (まだ取れていない・layout の無い行は要約のカード)
// - mode summary = 要約だけ(未読のモーダル)
// 題は描かない(包む Modal の title が持つ)。画像は保存値のまま渡す(AppImage が storage:// の ref を表示用にする)

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";

import type { InboxItemDetailDto } from "@/features/core/messaging/services/client/inboxClient";

import { InboxLayoutView, inboxSummaryOf } from "../InboxLayoutView";
import { formatInboxDate } from "../InboxItemRow";

export type InboxItemDetailProps = {
  /** 一覧の行(要約)か詳しい表示(layout・values・fields がある) */
  item: Pick<InboxItemDetailDto, "title" | "body" | "image" | "link" | "publishedAt"> &
    Partial<Pick<InboxItemDetailDto, "layout" | "values" | "fields">>;
  /** detail = 3 段(既定)/ summary = 要約だけ */
  mode?: "detail" | "summary";
  /** 詳しい表示を取っている間(要約の上に小さく出す) */
  loading?: boolean;
  /** 要約のカードの行き先のボタンの文言(既定「詳しく見る」) */
  linkLabel?: string;
};

export function InboxItemDetail({ item, mode = "detail", loading = false, linkLabel }: InboxItemDetailProps) {
  return (
    <Stack space={3}>
      <Flex align="center" gap="xs">
        <Para size="xs" tone="muted" className="my-0">
          {formatInboxDate(item.publishedAt)}
        </Para>
        {loading ? <Spinner className="size-3" /> : null}
      </Flex>
      <InboxLayoutView
        layout={item.layout}
        values={item.values}
        fields={item.fields}
        summary={inboxSummaryOf(item)}
        mode={mode}
        linkLabel={linkLabel}
      />
    </Stack>
  );
}
