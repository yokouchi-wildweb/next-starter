// src/app/(user)/(protected)/wallet/[slug]/purchase/failed/page.tsx

import { notFound } from "next/navigation";
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { PurchaseFailed } from "@/features/core/purchaseRequest/components/PurchaseFailed";
import { isValidSlug } from "@/features/core/wallet";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WalletPurchaseFailedPageRoute({ params }: PageProps) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    notFound();
  }

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>購入エラー</UserPageTitle>
        <PurchaseFailed slug={slug} />
      </Stack>
    </UserPage>
  );
}
