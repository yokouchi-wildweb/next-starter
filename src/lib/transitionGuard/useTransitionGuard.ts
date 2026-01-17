"use client";

import { usePathname, useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import { GUARD_FAIL_MESSAGES } from "./constants";
import type {
  GuardFailAction,
  GuardFailReason,
  TransitionGuardConfig,
  UseTransitionGuardResult,
} from "./types";
import { validateGuard } from "./validateToken";

/**
 * 遷移ガードフック
 * ページマウント時にトークン検証を行い、失敗時は指定された挙動を実行する
 *
 * @example ガードとして使用（失敗時リダイレクト）
 * ```tsx
 * "use client";
 *
 * export default function SignupCompletePage() {
 *   const { isChecking } = useTransitionGuard({
 *     allowedReferers: ["/signup/register"],
 *     onFail: { action: "redirect", path: "/signup" }
 *   });
 *
 *   if (isChecking) return <ScreenLoader />;
 *
 *   return <div>登録完了しました</div>;
 * }
 * ```
 *
 * @example 条件付き表示として使用（失敗しても何もしない）
 * ```tsx
 * "use client";
 *
 * export default function PurchaseCompletePage() {
 *   const { isChecking, isValidTransition } = useTransitionGuard({
 *     allowedReferers: ["/purchase/confirm"],
 *     onFail: { action: "none" }
 *   });
 *
 *   if (isChecking) return <ScreenLoader />;
 *
 *   return (
 *     <div>
 *       {isValidTransition && <SuccessBanner message="ご購入ありがとうございます！" />}
 *       <OrderDetails />
 *     </div>
 *   );
 * }
 * ```
 */
export function useTransitionGuard(
  config: TransitionGuardConfig
): UseTransitionGuardResult {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"checking" | "passed" | "failed">(
    "checking"
  );

  useEffect(() => {
    const result = validateGuard(pathname, config);

    if (result.passed) {
      setStatus("passed");
      return;
    }

    setStatus("failed");

    // action: "none" の場合は何もしない（条件付き表示用）
    if (config.onFail.action !== "none") {
      handleFailure(config.onFail, result.reason, router);
    }
  }, [pathname, config, router]);

  return {
    status,
    isChecking: status === "checking",
    isValidTransition: status === "passed",
  };
}

function getDefaultMessage(reason: GuardFailReason | undefined): string {
  if (reason && reason in GUARD_FAIL_MESSAGES) {
    return GUARD_FAIL_MESSAGES[reason];
  }
  return "不正なアクセス: 遷移ガードに失敗しました";
}

function handleFailure(
  onFail: GuardFailAction,
  reason: GuardFailReason | undefined,
  router: ReturnType<typeof useRouter>
): void {
  switch (onFail.action) {
    case "redirect":
      router.replace(onFail.path);
      break;
    case "notFound":
      notFound();
      break;
    case "error":
      throw new Error(onFail.message ?? getDefaultMessage(reason));
  }
}
