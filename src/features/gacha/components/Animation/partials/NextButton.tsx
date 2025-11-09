// src/features/gacha/components/NextButton.tsx

"use client";

import { GachaButton } from "../../GachaButton";

export type NextButtonProps = {
  label: string;
  onClick: () => void;
};

export function NextButton({ label, onClick }: NextButtonProps) {
  return (
    <div className="absolute-center z-10">
      <GachaButton onClick={onClick} tone="bounce" size="xl">
        {label}
      </GachaButton>
    </div>
  );
}
