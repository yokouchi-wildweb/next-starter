import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Para } from "@/components/TextBlocks";

export default function ServicesPage() {
  return (
    <UserPage>
      <UserPageTitle>サービス概要</UserPageTitle>
      <Para>
        このページはログイン状態に関わらずアクセス可能なサービス概要ページのサンプルです。
      </Para>
    </UserPage>
  );
}
