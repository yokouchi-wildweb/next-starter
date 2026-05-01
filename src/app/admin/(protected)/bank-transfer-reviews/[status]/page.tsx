// src/app/admin/(protected)/bank-transfer-reviews/[status]/page.tsx
//
// 自社銀行振込レビュー管理画面 (status 別タブ)。
// URL 動的セグメント (pending-review / confirmed / rejected) を Panel に渡し、
// URL 遷移ベースで status タブを切り替える。

import { notFound } from "next/navigation";

import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Section } from "@/components/Layout/Section";

import { BankTransferReviewListPanel } from "../_components/BankTransferReviewListPanel";
import { STATUS_VALUE_BY_SLUG } from "../_components/statusSlug";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "銀行振込レビュー",
};

type Props = {
  params: Promise<{ status: string }>;
};

export default async function AdminBankTransferReviewsStatusPage({ params }: Props) {
  const { status: slug } = await params;
  const status = STATUS_VALUE_BY_SLUG[slug];
  // 不正なスラッグ (定義外) は 404 とし、想定外 URL を許容しない
  if (!status) notFound();

  return (
    <AdminPage>
      <PageTitle>銀行振込レビュー</PageTitle>
      <Section>
        <BankTransferReviewListPanel status={status} />
      </Section>
    </AdminPage>
  );
}
