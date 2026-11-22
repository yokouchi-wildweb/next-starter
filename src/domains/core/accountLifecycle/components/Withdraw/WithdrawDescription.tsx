// src/domains/core/accountLifecycle/components/Withdraw/WithdrawDescription.tsx

import { Para } from "@/components/TextBlocks/Para";

import { accountLifecycleConfig } from "../../config";

export function WithdrawDescription() {
  return (
    <Para tone="muted" size="sm" className="mt-0 whitespace-pre-line">
      {accountLifecycleConfig.withdraw.description}
    </Para>
  );
}
