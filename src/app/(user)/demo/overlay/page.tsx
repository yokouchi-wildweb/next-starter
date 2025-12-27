"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Input } from "src/components/Form/Manual";
import { Label } from "@/components/Form/Label";
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { type SpinnerVariant } from "@/components/Overlays/Loading/Spinner";
import Modal from "@/components/Overlays/Modal";
import TabbedModal, { type TabbedModalTab } from "@/components/Overlays/TabbedModal";
import { Dialog } from "@/components/Overlays/Dialog";
import { ImageViewerProvider, ZoomableImage } from "@/components/Overlays/ImageViewer";
import { useAppToast } from "@/hooks/useAppToast";
import { imgPath } from "@/utils/assets";
import {
  type AppToastVariant,
  type AppToastPosition,
  type AppToastMode,
  type AppToastSize,
  type AppToastIconPreset,
} from "@/stores/appToast";
import { Checkbox } from "@/components/_shadcn/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_shadcn/select";
import { Textarea } from "@/components/_shadcn/textarea";
import { Section } from "@/components/Layout/Section";
import { PageTitle, Para, SecTitle } from "@/components/TextBlocks";
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

const APP_TOAST_VARIANTS = [
  { value: "success", label: "成功" },
  { value: "error", label: "エラー" },
  { value: "warning", label: "警告" },
  { value: "info", label: "情報" },
  { value: "loading", label: "ローディング" },
  { value: "primary", label: "プライマリ" },
  { value: "secondary", label: "セカンダリ" },
  { value: "accent", label: "アクセント" },
] as const satisfies ReadonlyArray<{ value: AppToastVariant; label: string }>;

const APP_TOAST_ICON_PRESETS = [
  { value: "default", label: "デフォルト（variantに従う）" },
  { value: "success", label: "成功 (✓)" },
  { value: "error", label: "エラー (✗)" },
  { value: "warning", label: "警告 (⚠)" },
  { value: "info", label: "情報 (ℹ)" },
  { value: "loading", label: "ローディング (⟳)" },
] as const satisfies ReadonlyArray<{ value: "default" | AppToastIconPreset; label: string }>;

const APP_TOAST_POSITIONS = [
  { value: "center", label: "中央" },
  { value: "top-left", label: "左上" },
  { value: "top-center", label: "上中央" },
  { value: "top-right", label: "右上" },
  { value: "bottom-left", label: "左下" },
  { value: "bottom-center", label: "下中央" },
  { value: "bottom-right", label: "右下" },
] as const satisfies ReadonlyArray<{ value: AppToastPosition; label: string }>;

const APP_TOAST_MODES = [
  { value: "notification", label: "通知（自動消去）" },
  { value: "persistent", label: "永続（手動消去）" },
] as const satisfies ReadonlyArray<{ value: AppToastMode; label: string }>;

const APP_TOAST_SIZES = [
  { value: "sm", label: "小" },
  { value: "md", label: "中" },
  { value: "lg", label: "大" },
] as const satisfies ReadonlyArray<{ value: AppToastSize; label: string }>;

const TABBED_MODAL_DEFAULT_TAB = "details" as const;

const TAB_DETAILS_PARAGRAPHS = Array.from({ length: 10 }, (_, index) => {
  const paragraphNumber = index + 1;
  return `(${paragraphNumber}/10) デモ用の長文コンテンツです。プロジェクト背景や意思決定の経緯、共有したい指針などを詳細に記述する想定でテキスト量を増やしています。スクロールで全体を読みながらタブを切り替え、UI の挙動を確認してください。`;
});

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

type AppToastDemoOptions = {
  variant: AppToastVariant;
  position: AppToastPosition;
  mode: AppToastMode;
  size: AppToastSize;
  duration: number;
  spinning: boolean;
  message: string;
  iconPreset: "default" | AppToastIconPreset;
};

const INITIAL_APP_TOAST_OPTIONS: AppToastDemoOptions = {
  variant: "success",
  position: "center",
  mode: "notification",
  size: "md",
  duration: 3000,
  spinning: false,
  message: "処理が完了しました",
  iconPreset: "default",
};

export default function OverlayDemoPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTabbedModalOpen, setIsTabbedModalOpen] = useState(false);
  const [activeTabbedModalTab, setActiveTabbedModalTab] = useState<string>(
    TABBED_MODAL_DEFAULT_TAB,
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmProcessing, setIsConfirmProcessing] = useState(false);
  const [options, setOptions] = useState<OverlayOptions>(INITIAL_OPTIONS);
  const [appToastOptions, setAppToastOptions] = useState<AppToastDemoOptions>(
    INITIAL_APP_TOAST_OPTIONS,
  );

  const { showAppToast, hideAppToast } = useAppToast();

  const closeTabbedModal = useCallback(() => {
    setIsTabbedModalOpen(false);
    setActiveTabbedModalTab(TABBED_MODAL_DEFAULT_TAB);
  }, []);

  const handleTabbedModalOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeTabbedModal();
        return;
      }
      setIsTabbedModalOpen(true);
    },
    [closeTabbedModal],
  );

  const tabbedModalTabs: TabbedModalTab[] = [
    {
      value: "details",
      label: "概要",
      content: (
        <div className="flex flex-col gap-3">
          <SecTitle as="h3" className="mt-0 text-base font-semibold">
            タブでセクションを整理
          </SecTitle>
          <Para size="sm" tone="muted" className="mt-0">
            モーダル内でも複数のレイアウトをまとめて表示できます。タブの切り替えは Radix Tabs を利用しており、
            固定ヘッダーのすぐ下に表示されます。
          </Para>
          <Para size="sm" className="mt-0">
            ここにはガイドテキストや操作の説明、ちょっとした統計カードなど自由に配置できます。必要に応じて
            Layout コンポーネントを組み合わせて UI を構成してください。
          </Para>
          {TAB_DETAILS_PARAGRAPHS.map((text) => (
            <Para key={text} size="sm" className="mt-0">
              {text}
            </Para>
          ))}
        </div>
      ),
    },
    {
      value: "memo",
      label: "共有メモ",
      content: (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tabbed-modal-title">メモタイトル</Label>
            <Input
              id="tabbed-modal-title"
              placeholder="例: 次のリリース計画"
              defaultValue="次のリリース計画"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tabbed-modal-description">詳細メモ</Label>
            <Textarea
              id="tabbed-modal-description"
              rows={4}
              placeholder="モーダル内で共有したいメモをここに書きます。"
              defaultValue="最優先で確認したいトピックを簡潔にまとめておくことで、参加者全員の認識を合わせられます。"
            />
          </div>
          <Button
            variant="secondary"
            className="self-start"
            onClick={() => setActiveTabbedModalTab("actions")}
          >
            次のタブへ進む
          </Button>
        </div>
      ),
    },
    {
      value: "actions",
      label: "アクション",
      content: (
        <div className="flex flex-col gap-4">
          <Para size="sm" tone="muted" className="mt-0">
            タブごとに異なるアクションボタンを配置できます。ここでは、メモの確認完了や閉じる操作を想定しています。
          </Para>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setActiveTabbedModalTab("memo")}>
              メモを編集する
            </Button>
            <Button variant="accent" onClick={() => toast("メモを共有しました。")}>
              メモを共有
            </Button>
            <Button variant="secondary" onClick={closeTabbedModal}>
              完了して閉じる
            </Button>
          </div>
        </div>
      ),
    },
  ];

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

  const handleShowAppToast = useCallback(() => {
    showAppToast({
      message: appToastOptions.message,
      variant: appToastOptions.variant,
      position: appToastOptions.position,
      mode: appToastOptions.mode,
      size: appToastOptions.size,
      duration: appToastOptions.duration,
      spinning: appToastOptions.spinning,
      icon: appToastOptions.iconPreset === "default" ? undefined : appToastOptions.iconPreset,
    });
  }, [showAppToast, appToastOptions]);

  return (
    <ImageViewerProvider>
    <div className="px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <Section as="header" className="my-0 flex flex-col gap-2">
          <PageTitle size="xxxl" className="font-semibold tracking-tight">
            Overlay デモ
          </PageTitle>
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
            <Button variant="secondary" onClick={() => setIsTabbedModalOpen(true)}>
              タブ付きモーダルを開く
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

        <Section
          as="section"
          className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm"
        >
          <div className="flex flex-col gap-2">
            <SecTitle as="h2">画像ビューアー</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              画像をクリックすると拡大表示されます。ImageViewerProvider でラップされた領域内で動作します。
            </Para>
          </div>
          <div className="flex flex-wrap gap-4">
            <ZoomableImage
              src={imgPath("logos/nextjs.png")}
              alt="Next.js ロゴ"
              className="h-24 w-24 rounded border object-contain p-2"
            />
            <ZoomableImage
              src={imgPath("logos/nextjs.png")}
              alt="Next.js ロゴ (大)"
              className="h-32 w-32 rounded border object-contain p-2"
            />
          </div>
        </Section>

        <Section
          as="section"
          className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm"
        >
          <div className="flex flex-col gap-2">
            <SecTitle as="h2">AppToast（アプリ用トースト）</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              画面中央または指定位置にリッチな通知を表示します。
              mode で自動消去（notification）か手動消去（persistent）を切り替えられます。
            </Para>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="app-toast-variant">バリアント</Label>
              <Select
                value={appToastOptions.variant}
                onValueChange={(value: AppToastVariant) =>
                  setAppToastOptions((prev) => ({ ...prev, variant: value }))
                }
              >
                <SelectTrigger id="app-toast-variant" className="w-full justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_TOAST_VARIANTS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="app-toast-position">位置</Label>
              <Select
                value={appToastOptions.position}
                onValueChange={(value: AppToastPosition) =>
                  setAppToastOptions((prev) => ({ ...prev, position: value }))
                }
              >
                <SelectTrigger id="app-toast-position" className="w-full justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_TOAST_POSITIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="app-toast-mode">モード</Label>
              <Select
                value={appToastOptions.mode}
                onValueChange={(value: AppToastMode) =>
                  setAppToastOptions((prev) => ({ ...prev, mode: value }))
                }
              >
                <SelectTrigger id="app-toast-mode" className="w-full justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_TOAST_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="app-toast-size">サイズ</Label>
              <Select
                value={appToastOptions.size}
                onValueChange={(value: AppToastSize) =>
                  setAppToastOptions((prev) => ({ ...prev, size: value }))
                }
              >
                <SelectTrigger id="app-toast-size" className="w-full justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_TOAST_SIZES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="app-toast-icon">アイコン</Label>
              <Select
                value={appToastOptions.iconPreset}
                onValueChange={(value: "default" | AppToastIconPreset) =>
                  setAppToastOptions((prev) => ({ ...prev, iconPreset: value }))
                }
              >
                <SelectTrigger id="app-toast-icon" className="w-full justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_TOAST_ICON_PRESETS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="app-toast-duration">表示時間 (ms)</Label>
              <Input
                id="app-toast-duration"
                type="number"
                min={1000}
                max={10000}
                step={500}
                value={appToastOptions.duration}
                onChange={(event) =>
                  setAppToastOptions((prev) => ({
                    ...prev,
                    duration: Number(event.target.value) || 3000,
                  }))
                }
                disabled={appToastOptions.mode === "persistent"}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="app-toast-message">メッセージ</Label>
              <Input
                id="app-toast-message"
                placeholder="例: 処理が完了しました"
                value={appToastOptions.message}
                onChange={(event) =>
                  setAppToastOptions((prev) => ({ ...prev, message: event.target.value }))
                }
              />
            </div>

            <div className="flex items-end gap-2 pb-1">
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={appToastOptions.spinning}
                  onCheckedChange={(checked) =>
                    setAppToastOptions((prev) => ({
                      ...prev,
                      spinning: Boolean(checked),
                    }))
                  }
                />
                アイコン回転
              </Label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleShowAppToast}>
              AppToast を表示
            </Button>
            {appToastOptions.mode === "persistent" && (
              <Button variant="outline" onClick={hideAppToast}>
                非表示にする
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="accent"
              size="sm"
              onClick={() => showAppToast("保存しました", "success")}
            >
              成功
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => showAppToast("エラーが発生しました", "error")}
            >
              エラー
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => showAppToast("注意してください", "warning")}
            >
              警告
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => showAppToast("お知らせです", "info")}
            >
              情報
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                showAppToast({
                  message: "処理中...",
                  variant: "loading",
                  mode: "persistent",
                });
                setTimeout(() => hideAppToast(), 3000);
              }}
            >
              ローディング
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              onClick={() => showAppToast("プライマリカラーの通知", "primary")}
            >
              Primary
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => showAppToast("セカンダリカラーの通知", "secondary")}
            >
              Secondary
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => showAppToast("アクセントカラーの通知", "accent")}
            >
              Accent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => showAppToast({
                message: "プライマリ色 + ローディングアイコン",
                variant: "primary",
                icon: "loading",
                spinning: true,
              })}
            >
              Primary + Loading Icon
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
                {isVisible ? <ScreenLoader {...overlayProps} /> : null}
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

      <TabbedModal
        open={isTabbedModalOpen}
        onOpenChange={handleTabbedModalOpenChange}
        title="タブ付きモーダル"
        tabs={tabbedModalTabs}
        value={activeTabbedModalTab}
        onValueChange={setActiveTabbedModalTab}
        maxWidth={720}
        height="50vh"
      />

      <Dialog
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
    </ImageViewerProvider>
  );
}
