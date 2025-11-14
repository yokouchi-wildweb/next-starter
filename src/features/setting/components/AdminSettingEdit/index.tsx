// src/features/setting/components/AdminSettingEdit/index.tsx

import type { Setting } from "@/features/setting/entities";
import { Suspense } from "react";
import EditSettingForm from "../common/EditSettingForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";
import { Section } from "@/components/Layout/Section";

type Props = {
  setting: Setting;
  redirectPath?: string;
};

export default function AdminSettingEdit({ setting, redirectPath }: Props) {
  return (
    <Section>
      <Suspense fallback={<FormSkeleton />}>
        <EditSettingForm setting={setting} redirectPath={redirectPath} />
      </Suspense>
    </Section>
  );
}
