import Link from "next/link";

import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";

export function AlreadyRegisteredState() {
  return (
    <Block space="sm">
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
    </Block>
  );
}
