// src/domains/core/messaging/components/common/DispatchTargetSummary/index.tsx
// 部品(props だけ、D210): 送信の宛先 = 宛先の指定と人数。全員・ロール・グループ宛ての送信でも利用者を並べない(送信の DTO も一覧を持たない)。
// - 全員 = 「全員」/ ロール = 「ロール「a・b」」(表示名は roleLabelOf、無ければ id)/ グループ = 「グループ「名前」」(targetGroup)/
//   選んだ利用者 = 「選んだ利用者」/ 宛先を持たない前の送る口の送信 = 指定は出さず人数だけ
// - 人数 = target.count(展開した後は送信の recipient_count、展開の前の選んだ利用者は送信に残した宛先の数)。
//   展開の前の全員・ロール・グループは null = 「人数は送る時に決まります」(0 名と出さない)
// 利用者の id・グループの id は見せない(D46・D94)

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks/Span";

import type { AdminDispatchDetail } from "@/domains/core/messaging/services/client/adminMessagingClient";

import { dispatchTargetGroupLabel } from "../DispatchRow";

export type DispatchTargetSummaryProps = {
  dispatch: Pick<AdminDispatchDetail, "target" | "targetGroup" | "recipientCount">;
  /** ロールの id → 表示名(既定 = id のまま)。入れ物が利用者のドメインのロールの表示名を渡す */
  roleLabelOf?: (role: string) => string;
};

/** 宛先の指定の文(宛先を持たない送信は null。target が無くグループだけ分かる送信はグループ) */
export function dispatchTargetSpecText(
  dispatch: DispatchTargetSummaryProps["dispatch"],
  roleLabelOf: (role: string) => string = (role) => role,
): string | null {
  const target = dispatch.target;
  if (!target) return dispatchTargetGroupLabel(dispatch);
  switch (target.type) {
    case "all":
      return "全員";
    case "role":
      return target.roles.length > 0 ? `ロール「${target.roles.map(roleLabelOf).join("・")}」` : "ロール";
    case "group":
      return dispatchTargetGroupLabel(dispatch) ?? "グループ";
    case "recipients":
      return "選んだ利用者";
    default:
      return null;
  }
}

/** 宛先の人数(target の count、宛先を持たない送信は recipientCount)。null = 人数は送る時に決まる */
export function dispatchTargetCount(dispatch: DispatchTargetSummaryProps["dispatch"]): number | null {
  return dispatch.target ? dispatch.target.count : dispatch.recipientCount;
}

/** 人数がまだ決まっていない時の文 */
export const DISPATCH_COUNT_PENDING_TEXT = "人数は送る時に決まります";

export function DispatchTargetSummary({ dispatch, roleLabelOf }: DispatchTargetSummaryProps) {
  const spec = dispatchTargetSpecText(dispatch, roleLabelOf);
  const count = dispatchTargetCount(dispatch);
  return (
    <Flex gap="md" wrap="wrap" data-slot="dispatch-target-summary">
      <Span size="sm" tone="muted" className="min-w-28">
        宛先
      </Span>
      <Span size="sm">
        {spec ? `${spec} ` : ""}
        {count === null ? DISPATCH_COUNT_PENDING_TEXT : `${count} 名`}
      </Span>
    </Flex>
  );
}
