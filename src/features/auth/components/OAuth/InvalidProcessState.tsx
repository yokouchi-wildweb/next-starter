// src/features/auth/components/OAuth/InvalidProcessState.tsx

import Link from "next/link";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";

export function InvalidProcessState() {
  return (
    <Block space="sm">
      <Para>認証に失敗しました。</Para>
      <Para>
        <Link href="/signup">
          <Button>再登録ページ</Button>
        </Link>
      </Para>
    </Block>
  );
}
