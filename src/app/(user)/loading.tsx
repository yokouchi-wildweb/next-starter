// src/app/(user)/loading.tsx

import { LoadingOverlay } from "@/components/Feedback/LoadingOverlay";

export default function UserLoading() {
  return (
    <LoadingOverlay
      mode="fullscreen"
      className="bg-transparent"
      spinnerClassName="h-12 w-12 text-background"
    />
  );
}
