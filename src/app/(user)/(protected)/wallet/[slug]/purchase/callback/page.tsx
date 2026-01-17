// src/app/(user)/(protected)/wallet/[slug]/purchase/callback/page.tsx

import { notFound } from "next/navigation";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { PurchaseCallback } from "@/features/core/purchaseRequest/components/PurchaseCallback";
import { isValidSlug } from "@/features/core/wallet";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WalletPurchaseCallbackPageRoute({ params }: PageProps) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    notFound();
  }

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <PurchaseCallback slug={slug} />
      </Stack>
    </UserPage>
  );
}
