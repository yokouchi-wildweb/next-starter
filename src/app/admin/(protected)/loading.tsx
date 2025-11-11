// src/app/admin/loading.tsx

import { LoadingOverlay } from "@/components/Feedback/LoadingOverlay";

export default function AdminLoading() {
  return (
    <LoadingOverlay
      mode="fullscreen"
      className="bg-muted"
      spinnerClassName="h-12 w-12 text-primary"
    />
  );
}
