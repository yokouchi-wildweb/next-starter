// src/app/(user)/gacha/start/page.tsx

export const dynamic = "force-dynamic";

import { Main, PageTitle } from "@/components/TextBlocks";
import Start from "@/features/gacha/components/Start";

export default function StartPage() {
  return (
    <Main>
      <PageTitle>ガチャスタート</PageTitle>
      <Start />
    </Main>
  );
}
