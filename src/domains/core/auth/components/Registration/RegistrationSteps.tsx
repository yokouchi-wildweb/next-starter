// src/domains/core/auth/components/Registration/RegistrationSteps.tsx

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

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
    <Section as="nav" aria-label="登録の進捗" className="flex flex-col gap-4">
      <Para size="sm" tone="muted" align="center" className="my-0">
        完了まで 残り{remainingSteps}ステップ
      </Para>
      <ol className="flex items-center justify-center gap-0">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li key={step.label} className="flex items-center">
              {/* ステップ */}
              <Flex direction="column" align="center">
                {/* ナンバーボックス */}
                <Flex
                  align="center"
                  justify="center"
                  className={`
                    h-10 w-10 rounded-lg
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
                </Flex>
                {/* ラベル */}
                <Span
                  size="xs"
                  weight="medium"
                  tone={isCompleted || isCurrent ? "default" : "muted"}
                  className="mt-2 whitespace-nowrap"
                >
                  {step.label}
                </Span>
              </Flex>

              {/* コネクターライン */}
              {index < steps.length - 1 && (
                <Block
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
    </Section>
  );
}
