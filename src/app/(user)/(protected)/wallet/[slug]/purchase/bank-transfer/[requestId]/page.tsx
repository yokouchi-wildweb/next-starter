// src/app/(user)/(protected)/wallet/[slug]/purchase/bank-transfer/[requestId]/page.tsx
//
// 自社受付の銀行振込（inhouse プロバイダ）の振込案内ページ。
// useCoinPurchase 経由で /wallet/[slug]/purchase からリダイレクトされてくる。
// ユーザーがブックマークして振込完了後に再訪することも想定している。
//
// SSR でガード（Pattern B 採用）:
// - 認可・存在は notFound() で同一視して情報を秘匿
// - provider/method 不整合も notFound()
// - status === "completed" → 完了画面へリダイレクト
// - status === "expired"/"failed"/"pending" → wallet トップへ救済リダイレクト
// - status === "processing" → 案内ページを表示

import { notFound, redirect } from "next/navigation";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { getBankTransferConfig } from "@/config/app/payment.config";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { BankTransferInstructionPage } from "@/features/core/purchaseRequest/components/BankTransferInstructionPage";
import {
  INHOUSE_BANK_TRANSFER_METHOD_ID,
  INHOUSE_PROVIDER_NAME,
} from "@/features/core/purchaseRequest/services/server/payment/inhouse";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import { isValidSlug } from "@/features/core/wallet";

type PageProps = {
  params: Promise<{ slug: string; requestId: string }>;
};

export default async function BankTransferInstructionPageRoute({ params }: PageProps) {
  const { slug, requestId } = await params;

  if (!isValidSlug(slug)) {
    notFound();
  }

  const session = await getSessionUser();
  // (user)/(protected) のレイアウトで未ログインは弾かれる前提だが、
  // 防御的に notFound() で情報を秘匿する。
  if (!session) {
    notFound();
  }

  // 認可と存在を 404 で同一視して秘匿
  const purchaseRequest = await purchaseRequestService.get(requestId);
  if (!purchaseRequest || purchaseRequest.user_id !== session.userId) {
    notFound();
  }

  // provider/method 不整合（誤遷移）も notFound() で秘匿
  if (
    purchaseRequest.payment_provider !== INHOUSE_PROVIDER_NAME ||
    purchaseRequest.payment_method !== INHOUSE_BANK_TRANSFER_METHOD_ID
  ) {
    notFound();
  }

  // status 別の分岐
  if (purchaseRequest.status === "completed") {
    redirect(`/wallet/${slug}/purchase/complete?request_id=${purchaseRequest.id}`);
  }
  if (purchaseRequest.status !== "processing") {
    // pending / expired / failed → wallet トップへ救済
    redirect(`/wallet/${slug}`);
  }

  const account = getBankTransferConfig().account;
  const identifier = purchaseRequest.provider_order_id ?? "";

  return (
    <UserPage containerType="narrowStack">
      <Stack space={3}>
        <UserPageTitle>銀行振込のご案内</UserPageTitle>
        <BankTransferInstructionPage
          requestId={purchaseRequest.id}
          paymentAmount={purchaseRequest.payment_amount}
          account={account}
          identifier={identifier}
          expiresAt={purchaseRequest.expires_at}
        />
      </Stack>
    </UserPage>
  );
}
