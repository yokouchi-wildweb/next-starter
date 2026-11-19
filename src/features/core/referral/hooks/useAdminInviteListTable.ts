// src/features/core/referral/hooks/useAdminInviteListTable.ts
// 招待コード発行者の管理一覧の処理(見た目は持たない): 行のクリックで開く紹介の一覧のモーダルの対象。
// core の AdminInviteList/Table と、fork が _components に置く自前の Table が同じくこれを呼ぶ(README「招待コード一覧に列を足す」)

"use client";

import { useCallback, useMemo, useState } from "react";

import type { InviteCodeWithCount } from "../services/server/wrappers/getInviteCodeListWithCounts";

export type UseAdminInviteListTableReturn = {
  /** 紹介の一覧のモーダルで開いている行(null = 閉じている) */
  selected: InviteCodeWithCount | null;
  open: (item: InviteCodeWithCount) => void;
  close: () => void;
  /** DataTable に広げる行の props(行を押すと紹介の一覧を開く) */
  rowProps: { onRowClick: (item: InviteCodeWithCount) => void; rowClassName: string };
  /** ReferralListModal に広げる props */
  modal: {
    inviterUserId: string | null;
    inviteCode: string | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
};

export function useAdminInviteListTable(): UseAdminInviteListTableReturn {
  const [selected, setSelected] = useState<InviteCodeWithCount | null>(null);
  const open = useCallback((item: InviteCodeWithCount) => setSelected(item), []);
  const close = useCallback(() => setSelected(null), []);

  return useMemo(
    () => ({
      selected,
      open,
      close,
      rowProps: { onRowClick: open, rowClassName: "cursor-pointer" },
      modal: {
        inviterUserId: selected?.coupon.attribution_user_id ?? null,
        inviteCode: selected?.coupon.code,
        open: selected !== null,
        onOpenChange: (next: boolean) => {
          if (!next) close();
        },
      },
    }),
    [close, open, selected],
  );
}
