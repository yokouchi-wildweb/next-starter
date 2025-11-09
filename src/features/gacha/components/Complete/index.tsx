// src/features/gacha/components/Complete/index.tsx

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/Form/Button";

export default function Complete() {
  const router = useRouter();

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-4">
      <Button onClick={() => router.push("/admin")}>管理画面へ戻る</Button>
    </div>
  );
}
