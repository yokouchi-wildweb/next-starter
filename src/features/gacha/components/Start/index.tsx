// src/features/gacha/components/Start/index.tsx

"use client";

import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/Feedback/LoadingOverlay";
import { useDrawGacha } from "../../hooks/useDrawGacha";
import { useGachaResult } from "@/stores/useGachaResult";
import { GachaButton } from "../GachaButton";
import { toast } from "sonner";
import { log } from "@/utils/log";
import { err } from "@/lib/errors";

export default function Start() {
  const router = useRouter();
  const { trigger: drawGacha, isMutating } = useDrawGacha();
  const { setCards } = useGachaResult();

  const handleClick = async () => {
    try {
      const cards = await drawGacha(5);
      log(3, "当選カード", cards);
      setCards(cards);
      router.push("/gacha/animation");
    } catch (error) {
      toast.error(err(error, "ガチャの抽選に失敗しました"));
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-4">
      {isMutating && (
        <LoadingOverlay
          className="z-50 bg-rainbow-gradient bg-[length:400%_400%] animate-gradient-x"
          spinnerClassName="h-24 w-24 text-white drop-shadow-2xl animate-gacha-loading"
          spinnerVariant="circle"
        />
      )}
      <GachaButton onClick={handleClick} tone="pulse" size="lg" disabled={isMutating}>
        ガチャを回す！
      </GachaButton>
    </div>
  );
}
