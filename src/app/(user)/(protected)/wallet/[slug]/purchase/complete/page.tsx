// src/app/(user)/(protected)/wallet/[slug]/purchase/complete/page.tsx

import { notFound } from "next/navigation";
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { PurchaseComplete } from "@/features/core/purchaseRequest/components/PurchaseComplete";
import { isValidSlug } from "@/features/core/wallet";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WalletPurchaseCompletePageRoute({ params }: PageProps) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    notFound();
  }

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>購入完了</UserPageTitle>
        <PurchaseComplete slug={slug} />
      </Stack>
    </UserPage>
  );
}
