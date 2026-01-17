import Link from "next/link";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks";

export function AlreadyRegisteredState() {
  return (
    <Stack space={4}>
      <Para>このメールアドレスはすでに登録済みです。</Para>
      <Para>
        ログインする場合は
        {" "}
        <Link href="/login" className="text-primary underline">
          ログインページ
        </Link>
        {" "}
        からサインインしてください。
      </Para>
    </Stack>
  );
}
