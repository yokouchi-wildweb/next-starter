// src/domains/core/messaging/components/common/InboxItemDetail/index.tsx
// 部品(props だけ): お知らせ 1 件の中身(公開の日時 + InboxLayoutView = レイアウトのお知らせの描き方 > 汎用)。詳細のモーダル InboxDetailModal が使う。
// 中身は詳しい表示(useInboxItemDetail の layout・values・fields)。取っている間は日時と読み込み中だけ(描けない文は出さない)。
// 題は描かない(包む Modal の title が持つ)

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { InlineLoader } from "@/components/Overlays/Loading";
import { Para } from "@/components/TextBlocks/Para";

import type { InboxItemDetailDto } from "@/domains/core/messaging/services/client/inboxClient";

import { InboxLayoutView, inboxSummaryOf } from "../InboxLayoutView";
import { formatInboxDate } from "../InboxItemRow";

export type InboxItemDetailProps = {
  /** 一覧の行か詳しい表示(layout・values・fields は詳しい表示だけが持つ) */
  item: Pick<InboxItemDetailDto, "title" | "body" | "image" | "link" | "publishedAt"> &
    Partial<Pick<InboxItemDetailDto, "layout" | "values" | "fields">>;
  /** 詳しい表示を取っている間 */
  loading?: boolean;
};

export function InboxItemDetail({ item, loading = false }: InboxItemDetailProps) {
  return (
    <Stack gap="sm">
      <Flex align="center" gap="xs">
        <Para size="xs" tone="muted" className="my-0">
          {formatInboxDate(item.publishedAt)}
        </Para>
        {loading ? <InlineLoader size="sm" className="py-0" spinnerClassName="size-3" /> : null}
      </Flex>
      {loading && !item.layout ? null : (
        <InboxLayoutView layout={item.layout} values={item.values} fields={item.fields} summary={inboxSummaryOf(item)} />
      )}
    </Stack>
  );
}
