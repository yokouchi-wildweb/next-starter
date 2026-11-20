// src/features/auth/components/AdminLogin/index.tsx

"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/Button/Button";
import { Label } from "@/components/Input/Label";
import { Input } from "@/components/Input/Input";
import { PasswordInput } from "@/components/Input/PasswordInput";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { useAdminLogin } from "@/features/core/auth/hooks/useAdminLogin";

export type AdminLoginProps = {
  /** ログイン成功後の遷移先。未指定時は useAdminLogin 側のデフォルト (/admin) */
  redirectTo?: string;
};

export function AdminLogin({ redirectTo }: AdminLoginProps = {}) {
  const { signIn, isLoading, errorMessage } = useAdminLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await signIn({ email, password, redirectTo });
  };

  return (
    <Section id="admin-login" className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Stack gap="xs">
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
        <Stack gap="xs">
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
        {errorMessage && (
          <Para tone="destructive" size="sm" align="inherit" className="my-0">
            {errorMessage}
          </Para>
        )}
        <Button type="submit" disabled={isLoading} className="w-full mt-4">
          {isLoading ? "ログイン中..." : "ログイン"}
        </Button>
      </form>
    </Section>
  );
}
