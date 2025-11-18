// src/features/gachaMachine/components/AdminGachaMachineEdit/index.tsx

import { Suspense } from "react";
import EditGachaMachineForm from "../common/EditGachaMachineForm";
import type { GachaMachine } from "../../entities";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

export type AdminGachaMachineEditProps = {
  gachaMachine: GachaMachine;
  redirectPath?: string;
};

export default function AdminGachaMachineEdit({ gachaMachine, redirectPath }: AdminGachaMachineEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditGachaMachineForm gachaMachine={gachaMachine} redirectPath={redirectPath} />
    </Suspense>
  );
}
