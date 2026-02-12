// src/features/core/user/components/Withdraw/WithdrawDescription.tsx

import { Para } from "@/components/TextBlocks";

export function WithdrawDescription() {
  return (
    <Para tone="muted" size="sm" className="mt-0">
      退会すると、アカウントに関連するデータにアクセスできなくなります。
      退会後に再度サービスを利用する場合は、新規登録が必要です。
    </Para>
  );
}
