import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { documentVariables, termsConfig } from "@/config/documents";
import { LegalDocumentRenderer } from "@/lib/structuredDocument/legal";

export default function TermsPage() {
  return (
    <UserPage containerType="narrowStack" space="md">
      <UserPageTitle>{termsConfig.title}</UserPageTitle>
      <LegalDocumentRenderer
        document={termsConfig}
        variables={documentVariables}
        showTitle={false}
      />
    </UserPage>
  );
}
