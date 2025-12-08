import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Section } from "@/components/Layout/Section";
import { PageTitle, Para } from "@/components/TextBlocks";

export default function ServicesPage() {
  return (
    <UserPage containerType="contentShell">
      <Section as="header">
        <PageTitle>サービス概要</PageTitle>
      </Section>
      <Para>
        このページはログイン状態に関わらずアクセス可能なサービス概要ページのサンプルです。
      </Para>
    </UserPage>
  );
}
