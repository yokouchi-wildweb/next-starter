// src/features/auth/components/OAuth/InvalidProcessState.tsx

import Link from "next/link";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks";

export function InvalidProcessState() {
  return (
    <Stack space={4}>
      <Para>認証に失敗しました。</Para>
      <Block>
          <Para>
              <Link href="/login">
                  <Button className="w-full">ログインページ</Button>
              </Link>
          </Para>

          <Para>

              <Link href="/signup">
                  <Button className="w-full">会員登録ページ</Button>
              </Link>
          </Para>
      </Block>
    </Stack>
  );
}
