// src/features/core/user/components/UserMyPage/index.tsx

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { UserPenIcon, LogOutIcon, PauseCircleIcon, UserXIcon, ChevronRightIcon, UserCircleIcon, ArrowLeftIcon, MailIcon, LoaderIcon, LockIcon, CheckCircleIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Input } from "@/components/Form/Input/Manual/Input";
import { PasswordInput } from "@/components/Form/Input/Manual/PasswordInput";
import { Label } from "@/components/Form/Label";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SecTitle } from "@/components/TextBlocks";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { useLogout } from "@/features/core/auth/hooks/useLogout";
import type { User } from "@/features/core/user/entities";
import { useUpdateMyProfile } from "@/features/core/user/hooks/useUpdateMyProfile";
import { useEmailChange } from "@/features/core/auth/hooks/useEmailChange";
import { useChangePassword } from "@/features/core/auth/hooks/useChangePassword";

import { ActionMenuCard } from "./ActionMenuCard";

type UserMyPageProps = {
  user: User;
};

type ViewType = "main" | "account-details" | "edit-name" | "edit-email" | "edit-password";

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : "100%",
    opacity: 0,
  }),
};

// 画面の深さを定義（スライド方向の判定に使用）
const viewDepth: Record<ViewType, number> = {
  "main": 0,
  "account-details": 1,
  "edit-name": 2,
  "edit-email": 2,
  "edit-password": 2,
};

export default function UserMyPage({ user }: UserMyPageProps) {
  const router = useRouter();
  const { logout, isLoading: isLoggingOut } = useLogout();
  const { updateProfile, isLoading: isUpdating, error: updateError } = useUpdateMyProfile();
  const { sendVerification, isLoading: isSendingEmail, error: emailError, isSuccess: emailSent, reset: resetEmailChange } = useEmailChange();
  const { changePassword, isLoading: isChangingPassword, error: passwordError, isSuccess: passwordChanged, reset: resetPasswordChange } = useChangePassword({ email: user.email });

  const [currentView, setCurrentView] = useState<ViewType>("main");
  const [direction, setDirection] = useState(1);
  const [editName, setEditName] = useState(user.name ?? "");
  const [displayedName, setDisplayedName] = useState(user.name ?? "未設定");
  const [editEmail, setEditEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const navigateTo = useCallback((view: ViewType) => {
    setDirection(viewDepth[view] > viewDepth[currentView] ? 1 : -1);
    setCurrentView(view);
    // メールアドレス編集画面に入る時にリセット
    if (view === "edit-email") {
      setEditEmail("");
      resetEmailChange();
    }
    // パスワード編集画面に入る時にリセット
    if (view === "edit-password") {
      setCurrentPassword("");
      setNewPassword("");
      resetPasswordChange();
    }
  }, [currentView, resetEmailChange, resetPasswordChange]);

  const handleSendEmailVerification = useCallback(async () => {
    const trimmedEmail = editEmail.trim();
    if (!trimmedEmail) return;

    await sendVerification({ newEmail: trimmedEmail });
  }, [editEmail, sendVerification]);

  const handleSaveName = useCallback(async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) return;

    const result = await updateProfile({ name: trimmedName });
    if (result) {
      setDisplayedName(result.name ?? "未設定");
      navigateTo("account-details");
      router.refresh();
    }
  }, [editName, updateProfile, navigateTo, router]);

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword.trim() || !newPassword.trim()) return;

    await changePassword(currentPassword, newPassword);
  }, [currentPassword, newPassword, changePassword]);

  return (
    <div className="overflow-hidden">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        {currentView === "main" && (
          <motion.div
            key="main"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Section>
              <Stack space={4}>
                <SecTitle as="h2">アカウント情報</SecTitle>
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <button
                    type="button"
                    onClick={() => navigateTo("account-details")}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <UserCircleIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">アカウント詳細を表示</p>
                        <p className="text-xs text-muted-foreground">
                          ユーザー名、メールアドレスを確認・編集
                        </p>
                      </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              </Stack>
            </Section>
            <Section>
              <Stack space={4}>
                <SecTitle as="h2">メニュー</SecTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ActionMenuCard
                    icon={LogOutIcon}
                    title={isLoggingOut ? "ログアウト中..." : "ログアウト"}
                    description="このアカウントからログアウト"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  />
                  {APP_FEATURES.user.pauseEnabled && (
                    <ActionMenuCard
                      icon={PauseCircleIcon}
                      title="休会する"
                      description="一時的にアカウントを休止"
                      href="/settings/pause"
                      variant="muted"
                    />
                  )}
                  {APP_FEATURES.user.withdrawEnabled && (
                    <ActionMenuCard
                      icon={UserXIcon}
                      title="退会する"
                      description="アカウントを削除"
                      href="/settings/withdraw"
                      variant="destructive"
                    />
                  )}
                </div>
              </Stack>
            </Section>
          </motion.div>
        )}

        {currentView === "account-details" && (
          <motion.div
            key="account-details"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Section>
              <Stack space={4}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo("main")}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="戻る"
                  >
                    <ArrowLeftIcon className="h-5 w-5 text-foreground" />
                  </button>
                  <SecTitle as="h2" className="!mt-0">アカウント詳細</SecTitle>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo("edit-name")}
                    className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <UserPenIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">ユーザー名</p>
                        <p className="text-xs text-muted-foreground">
                          {displayedName}
                        </p>
                      </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo("edit-email")}
                    className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <MailIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">メールアドレス</p>
                        <p className="text-xs text-muted-foreground">
                          {user.email ?? "未設定"}
                        </p>
                      </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                  </button>
                  {user.providerType === "email" && (
                    <button
                      type="button"
                      onClick={() => navigateTo("edit-password")}
                      className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <LockIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">パスワード</p>
                          <p className="text-xs text-muted-foreground">
                            パスワードを変更
                          </p>
                        </div>
                      </div>
                      <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </Stack>
            </Section>
          </motion.div>
        )}

        {currentView === "edit-name" && (
          <motion.div
            key="edit-name"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Section>
              <Stack space={4}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo("account-details")}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="戻る"
                    disabled={isUpdating}
                  >
                    <ArrowLeftIcon className="h-5 w-5 text-foreground" />
                  </button>
                  <SecTitle as="h2" className="!mt-0">ユーザー名を編集</SecTitle>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <Stack space={4}>
                    <div>
                      <Label htmlFor="display-name" className="mb-2 block">
                        ユーザー名
                      </Label>
                      <Input
                        type="text"
                        id="display-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="ユーザー名を入力"
                        disabled={isUpdating}
                      />
                    </div>
                    {updateError && (
                      <p className="text-sm text-destructive">{updateError}</p>
                    )}
                    <Button
                      type="button"
                      onClick={handleSaveName}
                      disabled={isUpdating || !editName.trim()}
                      className="w-full"
                    >
                      {isUpdating && <LoaderIcon className="h-4 w-4 animate-spin" />}
                      {isUpdating ? "保存中..." : "保存"}
                    </Button>
                  </Stack>
                </div>
              </Stack>
            </Section>
          </motion.div>
        )}

        {currentView === "edit-email" && (
          <motion.div
            key="edit-email"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Section>
              <Stack space={4}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo("account-details")}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="戻る"
                    disabled={isSendingEmail}
                  >
                    <ArrowLeftIcon className="h-5 w-5 text-foreground" />
                  </button>
                  <SecTitle as="h2" className="!mt-0">メールアドレスを編集</SecTitle>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  {emailSent ? (
                    <Stack space={4} className="text-center">
                      <div className="flex justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                          <MailIcon className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                      <Stack space={2}>
                        <p className="font-medium">確認メールを送信しました</p>
                        <p className="text-sm text-muted-foreground">
                          {editEmail} 宛に確認メールを送信しました。
                          メール内のリンクをクリックして変更を完了してください。
                        </p>
                      </Stack>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigateTo("account-details")}
                        className="w-full"
                      >
                        戻る
                      </Button>
                    </Stack>
                  ) : (
                    <Stack space={4}>
                      <div>
                        <Label className="mb-2 block text-muted-foreground">
                          現在のメールアドレス
                        </Label>
                        <p className="text-sm">{user.email ?? "未設定"}</p>
                      </div>
                      <div>
                        <Label htmlFor="new-email" className="mb-2 block">
                          新しいメールアドレス
                        </Label>
                        <Input
                          type="email"
                          id="new-email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="新しいメールアドレスを入力"
                          disabled={isSendingEmail}
                        />
                      </div>
                      {emailError && (
                        <p className="text-sm text-destructive">{emailError}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        新しいメールアドレス宛に確認メールが送信されます。
                        メール内のリンクをクリックすると変更が完了します。
                      </p>
                      <Button
                        type="button"
                        onClick={handleSendEmailVerification}
                        disabled={isSendingEmail || !editEmail.trim()}
                        className="w-full"
                      >
                        {isSendingEmail && <LoaderIcon className="h-4 w-4 animate-spin" />}
                        {isSendingEmail ? "送信中..." : "確認メールを送信"}
                      </Button>
                    </Stack>
                  )}
                </div>
              </Stack>
            </Section>
          </motion.div>
        )}

        {currentView === "edit-password" && (
          <motion.div
            key="edit-password"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Section>
              <Stack space={4}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo("account-details")}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="戻る"
                    disabled={isChangingPassword}
                  >
                    <ArrowLeftIcon className="h-5 w-5 text-foreground" />
                  </button>
                  <SecTitle as="h2" className="!mt-0">パスワードを変更</SecTitle>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  {passwordChanged ? (
                    <Stack space={4} className="text-center">
                      <div className="flex justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                          <CheckCircleIcon className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                      <Stack space={2}>
                        <p className="font-medium">パスワードを変更しました</p>
                        <p className="text-sm text-muted-foreground">
                          新しいパスワードでログインできるようになりました。
                        </p>
                      </Stack>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigateTo("account-details")}
                        className="w-full"
                      >
                        戻る
                      </Button>
                    </Stack>
                  ) : (
                    <Stack space={4}>
                      <div>
                        <Label htmlFor="current-password" className="mb-2 block">
                          現在のパスワード
                        </Label>
                        <PasswordInput
                          id="current-password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="現在のパスワードを入力"
                          disabled={isChangingPassword}
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-password" className="mb-2 block">
                          新しいパスワード
                        </Label>
                        <PasswordInput
                          id="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="新しいパスワードを入力"
                          disabled={isChangingPassword}
                        />
                      </div>
                      {passwordError && (
                        <p className="text-sm text-destructive">{passwordError}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        パスワードは6文字以上で設定してください。
                      </p>
                      <Button
                        type="button"
                        onClick={handleChangePassword}
                        disabled={isChangingPassword || !currentPassword.trim() || !newPassword.trim()}
                        className="w-full"
                      >
                        {isChangingPassword && <LoaderIcon className="h-4 w-4 animate-spin" />}
                        {isChangingPassword ? "変更中..." : "パスワードを変更"}
                      </Button>
                    </Stack>
                  )}
                </div>
              </Stack>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
