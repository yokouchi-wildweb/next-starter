// src/components/Feedback/Spinner.tsx

import {
  Loader2Icon,
  LoaderCircleIcon,
  LoaderIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

const SPINNER_ICONS = {
  default: Loader2Icon,
  ring: LoaderIcon,
  circle: LoaderCircleIcon,
} satisfies Record<string, LucideIcon>;

export type SpinnerVariant = keyof typeof SPINNER_ICONS;

type SpinnerProps = {
  className?: string;
  variant?: SpinnerVariant;
};

export function Spinner({ className, variant = "default" }: SpinnerProps) {
  const Icon = SPINNER_ICONS[variant];

  return <Icon className={cn("animate-spin", className)} />;
}
