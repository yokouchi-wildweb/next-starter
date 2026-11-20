// src/features/auth/components/OAuth/InvalidProcessState.tsx

import { Link } from "@/components/Navigation/Link";

import { Button } from "@/components/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

export function InvalidProcessState() {
  return (
    <Stack gap="md">
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
