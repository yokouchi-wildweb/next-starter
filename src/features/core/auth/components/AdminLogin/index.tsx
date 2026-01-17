// src/features/auth/components/AdminLogin/index.tsx

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/Form/Button/Button";
import { Label } from "@/components/Form/Label";
import { Input, PasswordInput } from "@/components/Form/Manual";
import { Stack } from "@/components/Layout/Stack";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { localLogin } from "@/features/core/auth/services/client/localLogin";
import { err } from "@/lib/errors";

export function AdminLogin() {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loading = isSubmitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await localLogin({ email, password });
      await refreshSession();
      // inactive の場合は復帰ページへ
      if (result.requiresReactivation) {
        router.push("/reactivate");
      } else {
        router.push("/admin");
      }
    } catch (error) {
      setErrorMessage(err(error, "ログインに失敗しました"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="admin-login" className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Stack space={2}>
          <Label htmlFor="admin-login-email" className="block text-foreground">
            メールアドレス
          </Label>
          <Input
            id="admin-login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Stack>
        <Stack space={2}>
          <Label htmlFor="admin-login-password" className="block text-foreground">
            パスワード
          </Label>
          <PasswordInput
            id="admin-login-password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Stack>
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        <Button type="submit" disabled={loading} className="w-full mt-4">
          {loading ? "ログイン中..." : "ログイン"}
        </Button>
      </form>
    </section>
  );
}
