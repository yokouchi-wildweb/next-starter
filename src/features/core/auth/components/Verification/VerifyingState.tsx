import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";

export function VerifyingState() {
  return (
    <ScreenLoader
      mode="local"
      className="bg-muted"
      spinnerClassName="h-12 w-12 text-primary"
      message="認証処理を実行しています"
    />
  );
}
