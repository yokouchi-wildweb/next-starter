"use client";

import { useEffect, useMemo, useState } from "react";

import { LoadingOverlay } from "@/components/Feedback/LoadingOverlay";
import { type SpinnerVariant } from "@/components/Feedback/Spinner";
import { Button } from "@/components/Form/Button";
import { Input } from "@/components/Form/manual";
import { Label } from "@/components/Form/Label";
import { Checkbox } from "@/components/Shadcn/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Shadcn/select";
import { Textarea } from "@/components/Shadcn/textarea";

const MODES = [
  { value: "local", label: "local (親要素内に表示)" },
  { value: "fullscreen", label: "fullscreen (画面全体に表示)" },
] as const satisfies ReadonlyArray<{ value: LoadingOverlayMode; label: string }>;

const SPINNER_VARIANTS = [
  { value: "default", label: "default" },
  { value: "ring", label: "ring" },
  { value: "circle", label: "circle" },
] as const satisfies ReadonlyArray<{ value: SpinnerVariant; label: string }>;

type LoadingOverlayMode = "local" | "fullscreen";

type OverlayOptions = {
  mode: LoadingOverlayMode;
  className: string;
  spinnerVariant: SpinnerVariant;
  spinnerClassName: string;
  showMessage: boolean;
  message: string;
  messageClassName: string;
};

const INITIAL_OPTIONS: OverlayOptions = {
  mode: "local",
  className: "",
  spinnerVariant: "default",
  spinnerClassName: "",
  showMessage: true,
  message: "データを読み込んでいます...",
  messageClassName: "",
};

export default function LoadingOverlayDemoPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [options, setOptions] = useState<OverlayOptions>(INITIAL_OPTIONS);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
    }, 5_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isVisible]);

  const overlayProps = useMemo(() => {
    return {
      mode: options.mode,
      className: options.className.trim() || undefined,
      spinnerVariant: options.spinnerVariant,
      spinnerClassName: options.spinnerClassName.trim() || undefined,
      message:
        options.showMessage && options.message.trim().length > 0
          ? options.message
          : options.showMessage
            ? ""
            : undefined,
      messageClassName:
        options.showMessage && options.messageClassName.trim().length > 0
          ? options.messageClassName
          : undefined,
    };
  }, [options]);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">LoadingOverlay デモ</h1>
          <p className="text-sm text-muted-foreground">
            コンポーネントのモードやオプションを変更し、どのように表示されるか確認できます。
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <section className="flex flex-col gap-6 rounded-lg border bg-background p-6 shadow-sm">
            <h2 className="text-lg font-medium">オプション</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="mode">モード</Label>
                <Select
                  value={options.mode}
                  onValueChange={(value: LoadingOverlayMode) =>
                    setOptions((prev) => ({ ...prev, mode: value }))
                  }
                >
                  <SelectTrigger id="mode" className="w-full justify-between">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="overlay-class">className (オーバーレイ)</Label>
                <Input
                  id="overlay-class"
                  placeholder="例: bg-background/90"
                  value={options.className}
                  onChange={(event) =>
                    setOptions((prev) => ({ ...prev, className: event.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="spinner-variant">spinnerVariant</Label>
                <Select
                  value={options.spinnerVariant}
                  onValueChange={(value: SpinnerVariant) =>
                    setOptions((prev) => ({ ...prev, spinnerVariant: value }))
                  }
                >
                  <SelectTrigger id="spinner-variant" className="w-full justify-between">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPINNER_VARIANTS.map((variant) => (
                      <SelectItem key={variant.value} value={variant.value}>
                        {variant.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="spinner-class">spinnerClassName</Label>
                <Input
                  id="spinner-class"
                  placeholder="例: text-primary"
                  value={options.spinnerClassName}
                  onChange={(event) =>
                    setOptions((prev) => ({ ...prev, spinnerClassName: event.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="gap-2">
                  <Checkbox
                    checked={options.showMessage}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({
                        ...prev,
                        showMessage: Boolean(checked),
                      }))
                    }
                  />
                  message を表示する
                </Label>
                <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="message" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      message
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="例: データを読み込んでいます..."
                      value={options.message}
                      onChange={(event) =>
                        setOptions((prev) => ({ ...prev, message: event.target.value }))
                      }
                      disabled={!options.showMessage}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label
                      htmlFor="message-class"
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      messageClassName
                    </Label>
                    <Input
                      id="message-class"
                      placeholder="例: text-destructive"
                      value={options.messageClassName}
                      onChange={(event) =>
                        setOptions((prev) => ({ ...prev, messageClassName: event.target.value }))
                      }
                      disabled={!options.showMessage}
                    />
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={() => setIsVisible(true)} disabled={isVisible} className="self-start">
              {isVisible ? "表示中..." : "オーバーレイを表示 (5 秒間)"}
            </Button>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">プレビュー</h2>
              <p className="text-sm text-muted-foreground">
                ボタンを押してから 5 秒間、選択した設定で LoadingOverlay が表示されます。
              </p>
            </div>
            <div className="relative min-h-72 overflow-hidden rounded-xl border bg-background p-8 shadow-inner">
              <div className="pointer-events-none select-none text-center text-sm text-muted-foreground">
                <p>ここにコンテンツが表示される想定です。</p>
                <p>local モードの場合、この枠内にオーバーレイが表示されます。</p>
              </div>
              {isVisible ? <LoadingOverlay {...overlayProps} /> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
