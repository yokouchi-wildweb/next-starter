// src/features/auth/components/AdminLogin/index.tsx

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/Form/Button/Button";
import { Label } from "@/components/Form/Label";
import { Input } from "@/components/Form/manual";
import { Block } from "@/components/Layout/Block";
import { useAuthSession } from "@/features/auth/hooks/useAuthSession";
import { localLogin } from "@/features/auth/services/client/localLogin";
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
      await localLogin({ email, password });
      await refreshSession();
      router.push("/admin");
    } catch (error) {
      setErrorMessage(err(error, "ログインに失敗しました"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="admin-login" className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Block space="xs">
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
        </Block>
        <Block space="xs">
          <Label htmlFor="admin-login-password" className="block text-foreground">
            パスワード
          </Label>
          <Input
            id="admin-login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Block>
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "ログイン中..." : "ログイン"}
        </Button>
      </form>
    </section>
  );
}
