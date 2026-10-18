// src/app/(user)/(legal)/terms/_screen/TermsScreen.tsx
// /terms の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(文書は設定 src/config/documents から読むだけ)。文言を変えるのは設定側、構成を変えるのは差し替え Screen で行う。

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { documentVariables, termsConfig } from "@/config/documents";
import { LegalDocumentRenderer } from "@/lib/structuredDocument/legal";

export function TermsScreen() {
  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{termsConfig.title}</UserPageTitle>
        <LegalDocumentRenderer document={termsConfig} variables={documentVariables} showTitle={false} />
      </Stack>
    </UserPage>
  );
}
