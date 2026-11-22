"use client";

// src/domains/core/messaging/hooks/useRecipientEstimate.ts
//
// 公開の hook: 宛先の人数の見込み(全員・ロール・グループ宛て)。送るモーダルが確認へ進む時に取り、確認の段で見せ、上限を超えたら送らせない。
// 自由連絡(MessageSendModal、estimateAdminRecipients)と定義連絡(DefinitionSendModal、estimateAdminDefinitionRecipients)が口を差し替えて使う(ticket 14 AMENDMENT 1)。
// - request(input) = 見込みを取って持つ(返す)。reset = 空に戻す(モーダルを閉じた・宛先を替えた時)
// - overLimit = グループの人数の上限を超えた(送る口が断る)。assertWithinLimit = 超えていれば overLimitText で投げる(送る直前に呼ぶ)
// - 見込みは送る時に数え直す(fixedAtSend)。表示は部品 RecipientEstimateView(common/SendConfirmView)

import { useCallback, useState } from "react";

import { useDomainMutation } from "@/lib/crud";

import type { RecipientEstimate } from "../services/client/sendClient";

/** 上限を超えた時の文(確認の段の理由と送る口の誤りで同じ文) */
export function overLimitText(estimate: Pick<RecipientEstimate, "count" | "memberLimit">): string {
  return `宛先数 ${estimate.count.toLocaleString("ja-JP")} 人が上限 ${(estimate.memberLimit ?? 0).toLocaleString("ja-JP")} 人を超えているため送信できません`;
}

export type UseRecipientEstimateOptions<TInput> = {
  /** 見込みの口(client service) */
  estimate: (input: TInput) => Promise<RecipientEstimate>;
  /** useDomainMutation のキー(モーダルごとに別) */
  key: string;
};

export function useRecipientEstimate<TInput>({ estimate: estimateOf, key }: UseRecipientEstimateOptions<TInput>) {
  const [estimate, setEstimate] = useState<RecipientEstimate | null>(null);
  const mutation = useDomainMutation<RecipientEstimate, TInput>(key, estimateOf);
  const { trigger } = mutation;

  const request = useCallback(
    async (input: TInput) => {
      const next = await trigger(input);
      setEstimate(next);
      return next;
    },
    [trigger],
  );
  const reset = useCallback(() => setEstimate(null), []);
  const assertWithinLimit = useCallback(() => {
    if (estimate?.overLimit) throw new Error(overLimitText(estimate));
  }, [estimate]);

  return {
    /** 直近の見込み(まだ・空に戻した後は null) */
    estimate,
    isEstimating: mutation.isMutating,
    overLimit: Boolean(estimate?.overLimit),
    request,
    reset,
    assertWithinLimit,
  };
}
