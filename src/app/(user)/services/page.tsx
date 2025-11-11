import { Main, PageTitle, Para, Section } from "@/components/TextBlocks";

export default function ServicesPage() {
  return (
    <Main variant="contentShell">
      <Section as="header">
        <PageTitle>サービス概要</PageTitle>
      </Section>
      <Para>
        このページはログイン状態に関わらずアクセス可能なサービス概要ページのサンプルです。
      </Para>
    </Main>
  );
}
