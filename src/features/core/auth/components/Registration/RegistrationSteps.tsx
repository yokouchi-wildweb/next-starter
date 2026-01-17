// src/features/core/auth/components/Registration/RegistrationSteps.tsx

import type { RegistrationMethod } from "./index";

type Step = {
  label: string;
};

const EMAIL_STEPS: Step[] = [
  { label: "アドレス入力" },
  { label: "メール認証" },
  { label: "基本情報設定" },
];

const OAUTH_STEPS: Step[] = [
  { label: "アカウント認証" },
  { label: "プロフィール入力" },
  { label: "登録完了" },
];

type RegistrationStepsProps = {
  method: RegistrationMethod;
  currentStep?: number;
};

export function RegistrationSteps({
  method,
  currentStep = 1,
}: RegistrationStepsProps) {
  const steps = method === "email" ? EMAIL_STEPS : OAUTH_STEPS;
  // 本登録ページでは常に残り1ステップ
  const remainingSteps = 1;

  return (
    <nav aria-label="登録の進捗" className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">
        完了まで 残り{remainingSteps}ステップ
      </p>
      <ol className="flex items-center justify-center gap-0">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li key={step.label} className="flex items-center">
              {/* ステップ */}
              <div className="flex flex-col items-center">
                {/* ナンバーボックス */}
                <div
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-lg
                    text-sm font-semibold transition-all duration-300
                    ${
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-accent text-accent-foreground ring-2 ring-accent ring-offset-2"
                          : "bg-muted text-muted-foreground"
                    }
                  `}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
                {/* ラベル */}
                <span
                  className={`
                    mt-2 text-xs font-medium whitespace-nowrap
                    ${
                      isCompleted || isCurrent
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* コネクターライン */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    mx-2 mt-[-1.5rem] h-0.5 w-12 sm:w-16
                    transition-colors duration-300
                    ${isCompleted ? "bg-primary" : "bg-muted"}
                  `}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
