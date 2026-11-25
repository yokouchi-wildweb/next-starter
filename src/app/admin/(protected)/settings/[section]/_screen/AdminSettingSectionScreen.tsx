// src/app/admin/(protected)/settings/[section]/_screen/AdminSettingSectionScreen.tsx
// /admin/settings/[section] の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { Suspense } from "react";

import AdminPage from "@/app/admin/_layout/AdminPage";
import { Section } from "@/components/Layout/Section";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import { createScreen } from "@/wiring/screen";

import EditSettingSectionForm from "./EditSettingSectionForm";
import { loadAdminSettingSectionScreen } from "./loader";

// 題名 = セクション名(load の後だけ。未知のキー・閉じた節は loader が 404 にする)
export const { Screen: AdminSettingSectionScreen, generateMetadata } = createScreen({
  load: loadAdminSettingSectionScreen,
  render: ({ sectionKey, section, setting, redirectPath, codeKeys }) => (
    <AdminPage title={section.label}>
      <Section>
        <Suspense fallback={<FormSkeleton />}>
          <EditSettingSectionForm sectionKey={sectionKey} setting={setting} redirectPath={redirectPath} codeKeys={codeKeys} />
        </Suspense>
      </Section>
    </AdminPage>
  ),
  metadata: ({ section }) => ({ title: section.label }),
});
