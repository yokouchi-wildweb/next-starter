// src/features/core/setting/components/AdminSettingSectionEdit/index.tsx

import { Suspense } from "react";

import { Section } from "@/components/Layout/Section";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import type { Setting } from "@/features/core/setting/entities";

import type { SettingSection } from "../../setting.sections";
import EditSettingSectionForm from "../common/EditSettingSectionForm";

type Props = {
  section: SettingSection;
  setting: Setting;
  redirectPath?: string;
};

/**
 * 管理画面のシステム設定ページで、セクション単位のフォームをラップする。
 * Section + Suspense の共通外装を担当する。
 */
export default function AdminSettingSectionEdit({ section, setting, redirectPath }: Props) {
  return (
    <Section>
      <Suspense fallback={<FormSkeleton />}>
        <EditSettingSectionForm
          section={section}
          setting={setting}
          redirectPath={redirectPath}
        />
      </Suspense>
    </Section>
  );
}
