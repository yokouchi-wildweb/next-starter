// src/app/(user)/(protected)/wallet/[slug]/purchase/page.tsx

import { notFound } from "next/navigation";
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { WalletPurchasePage } from "@/features/core/wallet/components/WalletPurchasePage";
import { getCurrencyConfigBySlug } from "@/features/core/wallet";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WalletPurchasePageRoute({ params }: PageProps) {
  const { slug } = await params;
  const config = getCurrencyConfigBySlug(slug);

  if (!config) {
    notFound();
  }

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{config.label}購入</UserPageTitle>
        <WalletPurchasePage slug={slug} />
      </Stack>
    </UserPage>
  );
}
