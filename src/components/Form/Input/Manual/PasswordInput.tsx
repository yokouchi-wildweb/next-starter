import { EyeIcon, EyeOffIcon } from "lucide-react";
import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Input } from "./Input";
import { Button } from "@/components/Form/Button/Button";

type InputProps = ComponentProps<typeof Input>;

/**
 * パスワード欄の autoComplete(必須)
 * - "current-password": 登録済みのパスワードを入れる欄(ログイン、変更画面の「現在のパスワード」)
 * - "new-password": 新しく決める欄(新規登録、再設定、変更後、管理者が他人のパスワードを設定する欄)
 * 未指定だとブラウザ(特に Safari)が役割を推測し、管理画面で管理者自身の保存済みパスワードが
 * 自動入力されるなどの事故になるため、型で必須にしている
 */
export type PasswordAutoComplete = "current-password" | "new-password";

export type PasswordInputProps = Omit<InputProps, "leftIcon" | "autoComplete"> & {
  /** 左側に表示するアイコン */
  leftIcon?: ReactNode;
  /** 欄の役割(必須)。PasswordAutoComplete を参照 */
  autoComplete: PasswordAutoComplete;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const { className, leftIcon, ...rest } = props;
  const [visible, setVisible] = useState(false);

  const toggle = () => setVisible((prev) => !prev);

  // leftIconがある場合はInputのleftIconを使用せず、自前でレンダリング
  // h-fitでGridレイアウト内でも高さがinputに合うようにする
  return (
    <div className="relative h-fit">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
          {leftIcon}
        </span>
      )}
      <Input
        {...rest}
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-8", leftIcon && "pl-10", className)}
      />
      <Button
        type="button"
        onClick={toggle}
        variant="mutedIcon"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2"
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        <span className="sr-only">{visible ? "パスワードを非表示" : "パスワードを表示"}</span>
      </Button>
    </div>
  );
});

PasswordInput.displayName = "PasswordInput";
