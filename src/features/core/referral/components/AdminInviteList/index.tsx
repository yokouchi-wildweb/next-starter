// 招待コード発行者一覧（管理画面用メインコンポーネント）

// セクションタブ（official / affiliate / invite ...）はここでは描画しない。
// 配置はページの関心事なので page.tsx が CouponSectionTabs を置く
// （src/app/admin/(protected)/coupons/_components/CouponSectionTabs.tsx）。

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import Header from "./Header";
import Table from "./Table";
import type { InviteCodeWithCount } from "../../services/server/wrappers/getInviteCodeListWithCounts";

export type AdminInviteListProps = {
  items: InviteCodeWithCount[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminInviteList({
  items,
  page,
  perPage,
  total,
}: AdminInviteListProps) {
  return (
    <Section>
      <Stack space={6}>
        <Header page={page} perPage={perPage} total={total} />
        <Table items={items} />
      </Stack>
    </Section>
  );
}
