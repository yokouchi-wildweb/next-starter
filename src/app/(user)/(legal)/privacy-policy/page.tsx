import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { documentVariables, privacyConfig } from "@/config/documents";
import { LegalDocumentRenderer } from "@/lib/structuredDocument/legal";

export default function PrivacyPolicyPage() {
  return (
    <UserPage containerType="narrowStack" space="md">
      <UserPageTitle>{privacyConfig.title}</UserPageTitle>
      <LegalDocumentRenderer
        document={privacyConfig}
        variables={documentVariables}
        showTitle={false}
      />
    </UserPage>
  );
}
