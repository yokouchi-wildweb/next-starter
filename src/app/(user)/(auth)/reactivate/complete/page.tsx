// src/app/(user)/(auth)/reactivate/complete/page.tsx

import Link from "next/link";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Para } from "@/components/TextBlocks";
import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";

export default function ReactivateCompletePage() {
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>復帰が完了しました</UserPageTitle>
      <Para>おかえりなさい。引き続きサービスをお楽しみください。</Para>

      <Flex direction="column" gap="sm">
        <Button asChild>
          <Link href="/mypage">マイページへ</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">トップへ戻る</Link>
        </Button>
      </Flex>
    </UserPage>
  );
}
