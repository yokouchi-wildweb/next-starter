// src/app/(user)/(legal)/privacy-policy/_screen/PrivacyPolicyScreen.tsx
// /privacy-policy の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(public。文書は設定 src/config/documents から読むだけ)。文言を変えるのは設定側、構成を変えるのは差し替え Screen で行う。

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { documentVariables, privacyConfig } from "@/config/documents";
import { LegalDocumentRenderer } from "@/lib/structuredDocument/legal";

import { loadPrivacyPolicyScreen } from "./loader";

export async function PrivacyPolicyScreen(props: ScreenProps) {
  await loadPrivacyPolicyScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{privacyConfig.title}</UserPageTitle>
        <LegalDocumentRenderer document={privacyConfig} variables={documentVariables} showTitle={false} />
      </Stack>
    </UserPage>
  );
}
