// src/app/(user)/(auth)/reactivate/complete/_screen/ReactivateCompleteScreen.tsx
// /reactivate/complete の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(静的な完了案内のみ)。

import Link from "next/link";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks";

export function ReactivateCompleteScreen() {
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>復帰が完了しました</UserPageTitle>
      <Para align="center">おかえりなさい。引き続きサービスをお楽しみください。</Para>

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
