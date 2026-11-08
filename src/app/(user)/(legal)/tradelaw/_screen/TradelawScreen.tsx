// src/app/(user)/(legal)/tradelaw/_screen/TradelawScreen.tsx
// /tradelaw(特定商取引法に基づく表記)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(public)。文書は legal の口 getLegalDocument("tradelaw") の差し込み済みの文書を読むだけ。文面を変えるのは legal の上書き
// (src/config/features/legal.config.ts、形: src/features/core/legal/README.md)、構成を変えるのは差し替え Screen で行う。

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { getLegalDocument, getLegalEnactedAtFormat } from "@/features/legal/documents";
import { LegalDocumentRenderer } from "@/lib/structuredDocument/legal";

import { loadTradelawScreen } from "./loader";

export async function TradelawScreen(props: ScreenProps) {
  await loadTradelawScreen(props);
  const document = getLegalDocument("tradelaw");

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{document.title}</UserPageTitle>
        <LegalDocumentRenderer
          document={document}
          enactedAtFormat={getLegalEnactedAtFormat()}
          showTitle={false}
          showEnactedAt={false}
        />
      </Stack>
    </UserPage>
  );
}
