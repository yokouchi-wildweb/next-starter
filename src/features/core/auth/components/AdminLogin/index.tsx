// src/features/auth/components/AdminLogin/index.tsx

"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Label } from "@/components/Form/Label";
import { Input, PasswordInput } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout/Stack";
import { useAdminLogin } from "@/features/core/auth/hooks/useAdminLogin";

export function AdminLogin() {
  const { signIn, isLoading, errorMessage } = useAdminLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await signIn({ email, password });
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
        <Button type="submit" disabled={isLoading} className="w-full mt-4">
          {isLoading ? "ログイン中..." : "ログイン"}
        </Button>
      </form>
    </section>
  );
}
