"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { LoadingOverlay } from "@/components/Feedback/LoadingOverlay";
import { type SpinnerVariant } from "@/components/Feedback/Spinner";
import { Button } from "@/components/Form/Button/Button";
import { Input } from "src/components/Form/Manual";
import { Label } from "@/components/Form/Label";
import Modal from "@/components/Overlays/Modal";
import { ConfirmDialog } from "@/components/Overlays/ConfirmDialog";
import { Checkbox } from "@/components/Shadcn/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Shadcn/select";
import { Textarea } from "@/components/Shadcn/textarea";
import { PageTitle, Para, Section, SecTitle } from "@/components/TextBlocks";
import { toast } from "sonner";

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

export default function OverlayDemoPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmProcessing, setIsConfirmProcessing] = useState(false);
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

  const handleConfirm = useCallback(async () => {
    setIsConfirmProcessing(true);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 600);
    });

    setIsConfirmProcessing(false);
    setIsConfirmOpen(false);
    toast.success("確認ダイアログで確定しました。");
  }, []);

  const handleShowToast = useCallback((variant: "success" | "info" | "error") => {
    const messageMap = {
      success: "操作が正常に完了しました。",
      info: "参考情報: 追加の確認は不要です。",
      error: "エラーが発生しました。再度お試しください。",
    } as const satisfies Record<"success" | "info" | "error", string>;

    if (variant === "success") {
      toast.success(messageMap.success);
      return;
    }

    if (variant === "info") {
      toast(messageMap.info);
      return;
    }

    toast.error(messageMap.error);
  }, []);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <Section as="header" className="my-0 flex flex-col gap-2">
          <PageTitle variant="showcase">Overlay デモ</PageTitle>
          <Para tone="muted" size="sm" className="mt-0">
            コンポーネントのモードやオプションを変更し、どのように表示されるか確認できます。
          </Para>
        </Section>

        <Section
          as="section"
          className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm"
        >
          <div className="flex flex-col gap-2">
            <SecTitle as="h2">各種オーバーレイの表示</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              LoadingOverlay と合わせて利用する機会が多いモーダル・確認ダイアログ・トーストの表示挙動を確認できます。
            </Para>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setIsModalOpen(true)}>モーダルを開く</Button>
            <Button variant="outline" onClick={() => setIsConfirmOpen(true)}>
              確認ダイアログを開く
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="accent" onClick={() => handleShowToast("success")}>成功トースト</Button>
            <Button variant="secondary" onClick={() => handleShowToast("info")}>
              インフォトースト
            </Button>
            <Button variant="destructive" onClick={() => handleShowToast("error")}>
              エラートースト
            </Button>
          </div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <Section
            as="section"
            className="order-2 my-0 flex flex-col gap-6 rounded-lg border bg-background p-6 shadow-sm lg:order-1"
          >
            <SecTitle as="h2">オプション</SecTitle>
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
          </Section>

          <div className="flex flex-col gap-6">
            <Section
              as="section"
              className="order-1 my-0 flex flex-col gap-4 rounded-lg border bg-background p-6 shadow-sm lg:order-none"
            >
              <div className="flex flex-col gap-3">
                <SecTitle as="h2">プレビュー</SecTitle>
                <Para tone="muted" size="sm" className="mt-0">
                  ボタンを押してから 5 秒間、選択した設定で LoadingOverlay が表示されます。
                </Para>
              </div>
              <div className="relative min-h-72 overflow-hidden rounded-xl border bg-background p-8 shadow-inner">
                <div className="pointer-events-none select-none text-center text-sm text-muted-foreground">
                  <p>ここにコンテンツが表示される想定です。</p>
                  <p>local モードの場合、この枠内にオーバーレイが表示されます。</p>
                </div>
                {isVisible ? <LoadingOverlay {...overlayProps} /> : null}
              </div>
            </Section>

          </div>
        </div>
      </div>

      <Modal open={isModalOpen} onOpenChange={setIsModalOpen} title="カスタムモーダル">
        <div className="flex flex-col gap-4">
          <Para className="mt-0">
            任意のコンテンツを含めることができる共通モーダルです。必要に応じてフォームや補足説明を配置し、操作完了後に閉じるよう制御します。
          </Para>
          <Button variant="secondary" className="self-start" onClick={() => setIsModalOpen(false)}>
            モーダルを閉じる
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsConfirmProcessing(false);
          }
          setIsConfirmOpen(open);
        }}
        title="重要な操作の確認"
        description="重要な操作の前などに意図を再確認することができます。例: 本当に実行しますか？"
        confirmLabel={isConfirmProcessing ? "処理中..." : "実行する"}
        cancelLabel="キャンセル"
        onConfirm={handleConfirm}
        confirmDisabled={isConfirmProcessing}
      />
    </div>
  );
}
