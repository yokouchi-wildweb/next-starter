// src/features/core/setting/components/AdminSettingSectionEdit/index.tsx

import { Suspense } from "react";

import { Section } from "@/components/Layout/Section";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import type { Setting } from "@/features/core/setting/entities";

import { toSettingSectionFormProps, type SettingSection } from "../../setting.sections";
import EditSettingSectionForm from "../common/EditSettingSectionForm";

type Props = {
  section: SettingSection;
  setting: Setting;
  redirectPath?: string;
};

/**
 * 管理画面のシステム設定ページで、セクション単位のフォームをラップする。
 * Section + Suspense の共通外装を担当する。
 *
 * `icon` / `order` / `allowRoles` などクライアント境界越えで問題となる（あるいは
 * フォーム描画に不要な）プロパティは `toSettingSectionFormProps` で事前に除外する。
 */
export default function AdminSettingSectionEdit({ section, setting, redirectPath }: Props) {
  const sectionForForm = toSettingSectionFormProps(section);
  return (
    <Section>
      <Suspense fallback={<FormSkeleton />}>
        <EditSettingSectionForm
          section={sectionForForm}
          setting={setting}
          redirectPath={redirectPath}
        />
      </Suspense>
    </Section>
  );
}
