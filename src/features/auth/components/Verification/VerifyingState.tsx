import { LoadingOverlay } from "@/components/Feedback/LoadingOverlay";

export function VerifyingState() {
  return (
    <LoadingOverlay
      mode="local"
      className="bg-muted"
      spinnerClassName="h-12 w-12 text-primary"
      message="認証処理を実行しています"
    />
  );
}
