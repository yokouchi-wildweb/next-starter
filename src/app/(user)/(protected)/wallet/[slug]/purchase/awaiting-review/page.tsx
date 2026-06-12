// src/app/(user)/(protected)/wallet/[slug]/purchase/awaiting-review/page.tsx
//
// 銀行振込の申告後、運営の確認待ち（通貨未付与）の案内ページ。
// confirm API の redirectUrl（管理者承認待ち / AI 判定不承認の要確認）から遷移してくる。

import { notFound } from "next/navigation";
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { PurchaseAwaitingReview } from "@/features/core/purchaseRequest/components/PurchaseAwaitingReview";
import { isValidSlug } from "@/features/core/wallet";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WalletPurchaseAwaitingReviewPageRoute({
  params,
}: PageProps) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    notFound();
  }

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>お振込みの確認待ち</UserPageTitle>
        <PurchaseAwaitingReview slug={slug} />
      </Stack>
    </UserPage>
  );
}
