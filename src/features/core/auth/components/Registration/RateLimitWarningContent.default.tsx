// src/features/core/auth/components/Registration/RateLimitWarningContent.default.tsx
// 警告モーダルの本文の既定。文言は src/features/core/auth/config.ts の rateLimitWarning(上書き src/config/features/auth.config.ts)、JSX ごと変えるなら 1 行スイッチ(RateLimitWarningContent.tsx)

import { Fragment } from "react";

import { Para } from "@/components/TextBlocks";
import { authConfig } from "@/features/auth/config";

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
