// src/features/gachaMachine/components/AdminGachaMachineCreate/index.tsx

import { Suspense } from "react";
import CreateGachaMachineForm from "../common/CreateGachaMachineForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

export type AdminGachaMachineCreateProps = {
  redirectPath?: string;
};

export default function AdminGachaMachineCreate({ redirectPath }: AdminGachaMachineCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateGachaMachineForm redirectPath={redirectPath} />
    </Suspense>
  );
}
