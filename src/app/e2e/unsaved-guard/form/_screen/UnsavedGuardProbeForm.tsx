// src/app/e2e/unsaved-guard/form/_screen/UnsavedGuardProbeForm.tsx
// 受入のテストのフォーム: 入力 1 つ(AppForm)と 4 つの経路の入口(棚の Link・素の <a>・router.push・router.back)

"use client";

import { useForm } from "react-hook-form";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button";
import { Input } from "@/components/Form/Input/Manual/Input";
import { Link } from "@/components/Navigation";
import { useRouter } from "@/lib/unsavedGuard";

const TARGET = "/e2e/unsaved-guard/target";

export function UnsavedGuardProbeForm() {
  const methods = useForm<{ note: string }>({ defaultValues: { note: "" } });
  const router = useRouter();
  return (
    <AppForm methods={methods} onSubmit={async () => router.push(TARGET)}>
      <Input id="note" aria-label="note" {...methods.register("note")} />
      <Button id="save" type="submit">
        save
      </Button>
      <Link id="shelf-link" href={TARGET}>
        shelf link
      </Link>
      {/* 受入のテスト: 素の <a> の経路を確かめる */}
      <a id="raw-a" href={TARGET}>
        raw a
      </a>
      <Button id="push" type="button" onClick={() => router.push(TARGET)}>
        router.push
      </Button>
      <Button id="back" type="button" onClick={() => router.back()}>
        router.back
      </Button>
    </AppForm>
  );
}
