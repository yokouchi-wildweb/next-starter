import { Link } from "@/components/Navigation/Link";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

export function AlreadyRegisteredState() {
  return (
    <Stack gap="md">
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
