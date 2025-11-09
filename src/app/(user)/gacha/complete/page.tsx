// src/app/(user)/gacha/complete/page.tsx

export const dynamic = "force-dynamic";

import { Main, PageTitle } from "@/components/TextBlocks";
import Complete from "@/features/gacha/components/Complete";

export default function CompletePage() {
  return (
    <Main>
      <PageTitle>プレビュー終了</PageTitle>
      <Complete />
    </Main>
  );
}
