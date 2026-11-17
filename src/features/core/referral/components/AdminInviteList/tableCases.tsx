// AdminInviteList/Table の出力を比べる場合(render テストと期待値の記録で同じ物を使う)
import { createElement, type ReactElement } from "react";

import type { InviteCodeWithCount } from "../../services/server/wrappers/getInviteCodeListWithCounts";

import AdminInviteListTable from "./Table";

const coupon = {
  id: "i1",
  code: "INV-AAA",
  status: "active",
  attribution_user_id: "u1",
  createdAt: new Date("2026-02-03T04:05:00Z"),
} as InviteCodeWithCount["coupon"];

export const sampleInvites = [
  { coupon, referralCount: 3, issuerName: "山田", rewardedReferralCount: 1, totalRewardAmount: 100 },
  { coupon: { ...coupon, id: "i2", code: "INV-BBB", status: "inactive", attribution_user_id: null }, referralCount: 0, issuerName: null, rewardedReferralCount: 0, totalRewardAmount: 0 },
] as unknown as InviteCodeWithCount[];

export const inviteTableCases: Record<string, ReactElement> = {
  list: createElement(AdminInviteListTable, { items: sampleInvites }),
  empty: createElement(AdminInviteListTable, {}),
};
