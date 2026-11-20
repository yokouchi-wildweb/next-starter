// src/app/(user)/loading.tsx

import { ScreenLoader } from "@/components/Overlays/Loading";

export default function UserLoading() {
  return (
    <ScreenLoader
      mode="fullscreen"
      className="bg-transparent"
      spinnerClassName="h-12 w-12 text-background"
    />
  );
}
