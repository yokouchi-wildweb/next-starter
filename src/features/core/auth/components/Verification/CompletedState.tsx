// src/features/auth/components/RegistrationEmailVerification/CompletedState.tsx

import Link from "next/link";

import { HideBottomNav } from "@/components/AppFrames/User/controls/BottomNavControl";
import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";

export function CompletedState() {
  return (
    <Block>
      <HideBottomNav sp />
      <Para>メール認証が完了しました。</Para>
      <Button asChild className="w-full justify-center">
        <Link href="/signup/register">本登録へ進む</Link>
      </Button>
    </Block>
  );
}
