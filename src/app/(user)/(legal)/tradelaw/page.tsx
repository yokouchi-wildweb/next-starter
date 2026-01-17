import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { documentVariables, tradelawConfig } from "@/config/documents";
import { LegalDocumentRenderer } from "@/lib/structuredDocument/legal";

export default function TradelawPage() {
  return (
    <UserPage containerType="narrowStack" space="md">
      <UserPageTitle>{tradelawConfig.title}</UserPageTitle>
      <LegalDocumentRenderer
        document={tradelawConfig}
        variables={documentVariables}
        showTitle={false}
        showEnactedAt={false}
      />
    </UserPage>
  );
}
