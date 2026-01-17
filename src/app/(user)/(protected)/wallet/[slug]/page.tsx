// src/app/(user)/(protected)/wallet/[slug]/page.tsx

import { notFound } from "next/navigation";
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { WalletBalancePage } from "@/features/core/wallet/components/WalletBalancePage";
import { getCurrencyConfigBySlug } from "@/features/core/wallet";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WalletPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const config = getCurrencyConfigBySlug(slug);

  if (!config) {
    notFound();
  }

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{config.label}管理</UserPageTitle>
        <WalletBalancePage slug={slug} />
      </Stack>
    </UserPage>
  );
}
