// src/app/(user)/(protected)/wallet/[slug]/history/page.tsx

import { notFound } from "next/navigation";
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { WalletHistoryPage } from "@/features/core/wallet/components/WalletHistoryPage";
import { getCurrencyConfigBySlug } from "@/features/core/wallet";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WalletHistoryPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const config = getCurrencyConfigBySlug(slug);

  if (!config) {
    notFound();
  }

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{config.label}履歴</UserPageTitle>
        <WalletHistoryPage slug={slug} />
      </Stack>
    </UserPage>
  );
}
