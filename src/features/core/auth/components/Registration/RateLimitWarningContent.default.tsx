// src/features/core/auth/components/Registration/RateLimitWarningContent.default.tsx
// 警告モーダルの本文の既定。文言は src/config/ui/rate-limit-warning.config.ts、JSX ごと変えるなら 1 行スイッチ(RateLimitWarningContent.tsx)

import { Fragment } from "react";

import { Para } from "@/components/TextBlocks";
import { RATE_LIMIT_WARNING } from "@/config/ui/rate-limit-warning.config";

export function RateLimitWarningContent() {
  return (
    <Para>
      {RATE_LIMIT_WARNING.bodyLines.map((line, index) => (
        <Fragment key={line}>
          {index > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </Para>
  );
}
