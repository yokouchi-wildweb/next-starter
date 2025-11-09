// src/features/card/components/AdminCardCreate/index.tsx
import { Suspense } from "react";
import CreateCardForm from "../common/CreateCardForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

type Props = {
  redirectPath?: string;
};

export default function AdminCardCreate({ redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateCardForm redirectPath={redirectPath} />
    </Suspense>
  );
}
