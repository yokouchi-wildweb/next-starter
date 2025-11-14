// src/features/auth/hooks/useCheckActionCode.ts

"use client";

import { useCallback, useState } from "react";

import { checkActionCodeValidity } from "@/lib/firebase/client/checkActionCodeValidity";

export function useCheckActionCode() {

  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const verify = useCallback(async (oobCode: string) => {
    setIsLoading(true);

    try {
      const valid = await checkActionCodeValidity(oobCode);
      setIsValid(valid);
      return valid;

    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    check: verify,
    isLoading,
    isValid,
  } as const;
}
