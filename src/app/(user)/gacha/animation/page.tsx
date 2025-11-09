// src/app/(user)/gacha/animation/page.tsx

export const dynamic = "force-dynamic";

import { Main, PageTitle } from "@/components/TextBlocks";
import Animation from "@/features/gacha/components/Animation";

export default function AnimationPage() {
  return (
    <Main>
      <PageTitle variant="srOnly">ガチャアニメーション</PageTitle>
      <Animation />
    </Main>
  );
}
