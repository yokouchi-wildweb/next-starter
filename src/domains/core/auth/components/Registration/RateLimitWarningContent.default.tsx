// src/domains/core/auth/components/Registration/RateLimitWarningContent.default.tsx
// 警告モーダルの本文の既定。文言は src/domains/core/auth/config.ts の rateLimitWarning(上書き src/config/domains/auth.config.ts)、JSX ごと変えるなら 1 行スイッチ(RateLimitWarningContent.tsx)

import { Fragment } from "react";

import { Para } from "@/components/TextBlocks/Para";
import { authConfig } from "@/domains/auth/config";

/** 差替点 rateLimitWarningContent の約束の型(props を受けない。置き換え .replace も同じ名前の部品を export する) */
export type RateLimitWarningContentProps = Record<string, never>;

export function RateLimitWarningContent() {
  return (
    <Para>
      {authConfig.rateLimitWarning.bodyLines.map((line, index) => (
        <Fragment key={line}>
          {index > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </Para>
  );
}
