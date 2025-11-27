 "use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const previousValueRef = useRef<File | null | undefined>(value);

  useEffect(() => {
    if (typeof value === "undefined") {
      previousValueRef.current = value ?? null;
      return;
    }
    const previous = previousValueRef.current;
    if (previous && !value) {
      setInternalResetSignal((signal) => signal + 1);
    }
    previousValueRef.current = value ?? null;
  }, [value]);

  const handleFileChange = useCallback(
    (file: File | null) => {
      onValueChange?.(file);
    },
    [onValueChange],
  );

  const resetSignal = internalResetSignal + resetKey;

  return <MediaInput {...mediaInputProps} onFileChange={handleFileChange} resetSignal={resetSignal} />;
};
