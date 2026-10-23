// src/app/(user)/(legal)/tradelaw/_screen/TradelawScreen.tsx
// /tradelaw(特定商取引法に基づく表記)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(文書は設定 src/config/documents から読むだけ)。文言を変えるのは設定側、構成を変えるのは差し替え Screen で行う。

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { documentVariables, tradelawConfig } from "@/config/documents";
import { LegalDocumentRenderer } from "@/lib/structuredDocument/legal";

export function TradelawScreen() {
  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{tradelawConfig.title}</UserPageTitle>
        <LegalDocumentRenderer
          document={tradelawConfig}
          variables={documentVariables}
          showTitle={false}
          showEnactedAt={false}
        />
      </Stack>
    </UserPage>
  );
}
