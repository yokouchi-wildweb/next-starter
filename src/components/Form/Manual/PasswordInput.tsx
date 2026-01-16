import { EyeIcon, EyeOffIcon } from "lucide-react";
import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Input } from "./Input";
import { Button } from "@/components/Form/Button/Button";

type InputProps = ComponentProps<typeof Input>;

export type PasswordInputProps = Omit<InputProps, "leftIcon"> & {
  /** 左側に表示するアイコン */
  leftIcon?: ReactNode;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const { className, leftIcon, ...rest } = props;
  const [visible, setVisible] = useState(false);

  const toggle = () => setVisible((prev) => !prev);

  // leftIconがある場合はInputのleftIconを使用せず、自前でレンダリング
  return (
    <div className="relative h-9">
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
