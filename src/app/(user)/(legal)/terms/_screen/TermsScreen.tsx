// src/app/(user)/(legal)/terms/_screen/TermsScreen.tsx
// /terms の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(public)。文書は legal の口 getLegalDocument("terms") の差し込み済みの文書を読むだけ。文面を変えるのは legal の上書き
// (src/config/domains/legal.config.ts、形: src/domains/core/legal/README.md)、構成を変えるのは差し替え Screen で行う。

import type { ScreenProps } from "@/lib/screens";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { getLegalDocument, getLegalEnactedAtFormat } from "@/domains/legal/documents";
import { LegalDocumentRenderer } from "@/lib/structuredDocument";

import { loadTermsScreen } from "./loader";

export async function TermsScreen(props: ScreenProps) {
  await loadTermsScreen(props);
  const document = getLegalDocument("terms");

  return (
    <UserPage containerType="narrowStack">
      <Stack gap="lg">
        <UserPageTitle>{document.title}</UserPageTitle>
        <LegalDocumentRenderer document={document} enactedAtFormat={getLegalEnactedAtFormat()} showTitle={false} />
      </Stack>
    </UserPage>
  );
}
