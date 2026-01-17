import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { documentVariables, termsConfig } from "@/config/documents";
import { LegalDocumentRenderer } from "@/lib/structuredDocument/legal";

export default function TermsPage() {
  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{termsConfig.title}</UserPageTitle>
        <LegalDocumentRenderer
          document={termsConfig}
          variables={documentVariables}
          showTitle={false}
        />
      </Stack>
    </UserPage>
  );
}
