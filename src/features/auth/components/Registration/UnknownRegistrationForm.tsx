// src/features/auth/components/Registration/UnknownRegistrationForm.tsx

import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";

export function UnknownRegistrationForm() {
  return (
    <Block>
      <Para tone="error" size="sm">
        不正な登録手続きです。
      </Para>
    </Block>
  );
}
