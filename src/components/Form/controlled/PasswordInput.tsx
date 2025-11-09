import { Input } from "@/components/Form/manual";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { FieldPath, FieldValues } from "react-hook-form";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ControlledInputProps } from "@/types/form";
import { Button } from "@/components/Form/button/Button";

export const PasswordInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: ControlledInputProps<TFieldValues, TName>,
) => {
  const { field, className, ...rest } = props;
  const [visible, setVisible] = useState(false);
  const toggle = () => setVisible((v) => !v);
  return (
    <div className="relative">
      <Input {...field} {...rest} type={visible ? "text" : "password"} className={cn("pr-8", className)} />
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
};
