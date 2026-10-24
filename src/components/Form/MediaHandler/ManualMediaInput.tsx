 "use client";

import { useCallback, useState } from "react";

import { MediaInput, type MediaInputProps } from "@/lib/mediaInputSuite";

type BaseProps = Omit<MediaInputProps, "onFileChange" | "resetSignal">;

export type ManualMediaInputProps = BaseProps & {
  value?: File | null;
  onValueChange?: (file: File | null) => void;
  resetKey?: number;
};

export const ManualMediaInput = ({
  value,
  onValueChange,
  resetKey = 0,
  ...mediaInputProps
}: ManualMediaInputProps) => {
  const [internalResetSignal, setInternalResetSignal] = useState(0);
  // 値がファイルから null に変わったら入力をリセットする(undefined = 非制御は対象外)。
  // 前回の render の値と比べて render 中に調整する
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    if (typeof value !== "undefined" && previousValue && !value) {
      setInternalResetSignal((signal) => signal + 1);
    }
  }

  const handleFileChange = useCallback(
    (file: File | null) => {
      onValueChange?.(file);
    },
    [onValueChange],
  );

  const resetSignal = internalResetSignal + resetKey;

  return <MediaInput {...mediaInputProps} onFileChange={handleFileChange} resetSignal={resetSignal} />;
};
