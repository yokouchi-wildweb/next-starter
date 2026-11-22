// src/app/admin/(protected)/settings/[section]/_screen/AdminSettingSectionScreen.tsx
// /admin/settings/[section] の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { Metadata } from "next";
import { Suspense } from "react";

import AdminPage from "@/app/admin/_layout/AdminPage";
import type { ScreenProps } from "@/lib/screens";
import { Section } from "@/components/Layout/Section";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import { openSections } from "@/domains/core/setting/definitions";
import { gate } from "@/featureGate";

import EditSettingSectionForm from "./EditSettingSectionForm";
import { loadAdminSettingSectionScreen, type AdminSettingSectionScreenParams } from "./loader";

/** タイトル = セクション名(未知のキーは既定の「システム設定」。404 にするのは loader) */
export async function generateMetadata({ params }: { params: Promise<AdminSettingSectionScreenParams> }): Promise<Metadata> {
  const { section } = await params;
  return { title: openSections(gate.plugs)[section]?.label ?? "システム設定" };
}

export async function AdminSettingSectionScreen(props: ScreenProps<AdminSettingSectionScreenParams>) {
  const { sectionKey, section, setting, redirectPath, codeKeys } = await loadAdminSettingSectionScreen(props);

  return (
    <AdminPage title={section.label}>
      <Section>
        <Suspense fallback={<FormSkeleton />}>
          <EditSettingSectionForm sectionKey={sectionKey} setting={setting} redirectPath={redirectPath} codeKeys={codeKeys} />
        </Suspense>
      </Section>
    </AdminPage>
  );
}
