// src/features/setting/components/AdminSettingEdit/index.tsx

import type { Setting } from "@/features/setting/entities";
import { Suspense } from "react";
import EditSettingForm from "../common/EditSettingForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";
import { DeveloperMotivationChart } from "@/components/Admin/DeveloperMotivationChart";
import { Section } from "@/components/TextBlocks";

type Props = {
  setting: Setting;
  redirectPath?: string;
};

export default function AdminSettingEdit({ setting, redirectPath }: Props) {
  return (
    <Section>
      <DeveloperMotivationChart
        percentage={setting.developerMotivation ?? 0}
      />
      <Suspense fallback={<FormSkeleton />}>
        <EditSettingForm setting={setting} redirectPath={redirectPath} />
      </Suspense>
    </Section>
  );
}
