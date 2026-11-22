// 招待コード発行者一覧（管理画面用メインコンポーネント）

// セクションタブ（official / affiliate / invite ...）はここでは描画しない。
// 配置はページの関心事なので Screen が AdminCouponSectionTabs を置く
// （@/domains/core/coupon/components/AdminCouponSectionTabs）。

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import Header from "./Header";
import Table from "./Table";
import type { InviteCodeWithCount } from "../../services/server/wrappers/getInviteCodeListWithCounts";

export { default as AdminInviteListHeader } from "./Header";
export { default as ReferralListModal } from "./ReferralListModal";
export { default as AdminInviteListTable } from "./Table";
export { createAdminInviteListColumns } from "./columns";

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
      <Stack gap="lg">
        <Header page={page} perPage={perPage} total={total} />
        <Table items={items} />
      </Stack>
    </Section>
  );
}
