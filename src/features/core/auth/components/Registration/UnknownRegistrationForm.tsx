// src/features/auth/components/Registration/UnknownRegistrationForm.tsx

import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks/Para";

export function UnknownRegistrationForm() {
  return (
    <Block>
      <Para tone="destructive" size="sm">
        不正な登録手続きです。
      </Para>
    </Block>
  );
}
