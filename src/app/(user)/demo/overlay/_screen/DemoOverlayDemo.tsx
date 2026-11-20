// src/app/(user)/demo/overlay/_screen/DemoOverlayDemo.tsx
// /demo/overlay のデモ本体(client)。Screen が描く。
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Form/Button/Button";
import { BooleanCheckboxInput, ComboboxInput, Input, NumberInput, SelectInput, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { type SpinnerVariant } from "@/components/Overlays/Loading/Spinner";
import Modal from "@/components/Overlays/Modal";
import TabbedModal, { type TabbedModalTab } from "@/components/Overlays/TabbedModal";
import { Dialog } from "@/components/Overlays/Dialog";
import { ImageViewerProvider, ZoomableImage } from "@/components/Overlays/ImageViewer";
import { Popover } from "@/components/Overlays/Popover";
import { HelpTip } from "@/components/Overlays/Tooltip";
import { useToast, type ToastVariant, type ToastPosition, type ToastMode, type ToastSize, type ToastIconPreset } from "@/lib/toast";
import { business } from "@/business";
import { logoPath } from "@/utils/assets";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { PageTitle } from "@/components/TextBlocks/PageTitle";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";

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
] as const satisfies ReadonlyArray<{ value: ToastVariant; label: string }>;

const APP_TOAST_ICON_PRESETS = [
  { value: "default", label: "デフォルト（variantに従う）" },
  { value: "success", label: "成功 (✓)" },
  { value: "error", label: "エラー (✗)" },
  { value: "warning", label: "警告 (⚠)" },
  { value: "info", label: "情報 (ℹ)" },
  { value: "loading", label: "ローディング (⟳)" },
] as const satisfies ReadonlyArray<{ value: "default" | ToastIconPreset; label: string }>;

const APP_TOAST_POSITIONS = [
  { value: "center", label: "中央" },
  { value: "top-left", label: "左上" },
  { value: "top-center", label: "上中央" },
  { value: "top-right", label: "右上" },
  { value: "bottom-left", label: "左下" },
  { value: "bottom-center", label: "下中央" },
  { value: "bottom-right", label: "右下" },
] as const satisfies ReadonlyArray<{ value: ToastPosition; label: string }>;

const APP_TOAST_MODES = [
  { value: "notification", label: "通知（自動消去）" },
  { value: "persistent", label: "永続（手動消去）" },
] as const satisfies ReadonlyArray<{ value: ToastMode; label: string }>;

const APP_TOAST_SIZES = [
  { value: "sm", label: "小" },
  { value: "md", label: "中" },
  { value: "lg", label: "大" },
] as const satisfies ReadonlyArray<{ value: ToastSize; label: string }>;

const TABBED_MODAL_DEFAULT_TAB = "details" as const;

const TAB_DETAILS_PARAGRAPHS = Array.from({ length: 10 }, (_, index) => {
  const paragraphNumber = index + 1;
  return `(${paragraphNumber}/10) デモ用の長文コンテンツです。プロジェクト背景や意思決定の経緯、共有したい指針などを詳細に記述する想定でテキスト量を増やしています。スクロールで全体を読みながらタブを切り替え、UI の挙動を確認してください。`;
});

/** 重なりの確かめの台の候補(長い一覧) */
const STACK_BENCH_OPTIONS = Array.from({ length: 40 }, (_, i) => ({ value: `opt-${i + 1}`, label: `候補 ${i + 1}` }));

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
  variant: ToastVariant;
  position: ToastPosition;
  mode: ToastMode;
  size: ToastSize;
  duration: number;
  spinning: boolean;
  message: string;
  iconPreset: "default" | ToastIconPreset;
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

export function DemoOverlayDemo() {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // モーダルの中の重なりの確かめの台(浮く物は後に開いた物が上、当議会 D189)
  const [stackComboValue, setStackComboValue] = useState<string | number | boolean | null>(null);
  const [stackSelectValue, setStackSelectValue] = useState<string | number | boolean | "" | null>("");
  const [isStackConfirmOpen, setIsStackConfirmOpen] = useState(false);
  const [isStackLoaderVisible, setIsStackLoaderVisible] = useState(false);
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

  const { showToast, hideToast } = useToast();

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
        <Stack className="gap-3">
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
        </Stack>
      ),
    },
    {
      value: "memo",
      label: "共有メモ",
      content: (
        <Stack className="gap-4">
          <Stack className="gap-2">
            <Label htmlFor="tabbed-modal-title">メモタイトル</Label>
            <Input
              id="tabbed-modal-title"
              placeholder="例: 次のリリース計画"
              defaultValue="次のリリース計画"
            />
          </Stack>
          <Stack className="gap-2">
            <Label htmlFor="tabbed-modal-description">詳細メモ</Label>
            <Textarea
              id="tabbed-modal-description"
              rows={4}
              placeholder="モーダル内で共有したいメモをここに書きます。"
              defaultValue="最優先で確認したいトピックを簡潔にまとめておくことで、参加者全員の認識を合わせられます。"
            />
          </Stack>
          <Button
            variant="secondary"
            className="self-start"
            onClick={() => setActiveTabbedModalTab("actions")}
          >
            次のタブへ進む
          </Button>
        </Stack>
      ),
    },
    {
      value: "actions",
      label: "アクション",
      content: (
        <Stack className="gap-4">
          <Para size="sm" tone="muted" className="mt-0">
            タブごとに異なるアクションボタンを配置できます。ここでは、メモの確認完了や閉じる操作を想定しています。
          </Para>
          <Flex wrap="wrap" className="gap-3">
            <Button variant="outline" onClick={() => setActiveTabbedModalTab("memo")}>
              メモを編集する
            </Button>
            <Button variant="accent" onClick={() => showToast("メモを共有しました。", "info")}>
              メモを共有
            </Button>
            <Button variant="secondary" onClick={closeTabbedModal}>
              完了して閉じる
            </Button>
          </Flex>
        </Stack>
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
    showToast("確認ダイアログで確定しました。", "success");
  }, [showToast]);

  const handleShowToast = useCallback((variant: "success" | "info" | "error") => {
    const messageMap = {
      success: "操作が正常に完了しました。",
      info: "参考情報: 追加の確認は不要です。",
      error: "エラーが発生しました。再度お試しください。",
    } as const satisfies Record<"success" | "info" | "error", string>;

    showToast(messageMap[variant], variant);
  }, [showToast]);

  const handleShowAppToast = useCallback(() => {
    showToast({
      message: appToastOptions.message,
      variant: appToastOptions.variant,
      position: appToastOptions.position,
      mode: appToastOptions.mode,
      size: appToastOptions.size,
      duration: appToastOptions.duration,
      spinning: appToastOptions.spinning,
      icon: appToastOptions.iconPreset === "default" ? undefined : appToastOptions.iconPreset,
    });
  }, [showToast, appToastOptions]);

  return (
    <ImageViewerProvider>
    <Block className="px-6 py-10">
      <Stack className="mx-auto w-full max-w-5xl gap-8">
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
          <Stack className="gap-2">
            <SecTitle as="h2">各種オーバーレイの表示</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              LoadingOverlay と合わせて利用する機会が多いモーダル・確認ダイアログ・トーストの表示挙動を確認できます。
            </Para>
          </Stack>

          <Flex wrap="wrap" className="gap-3">
            <Button onClick={() => setIsModalOpen(true)}>モーダルを開く</Button>
            <Button variant="outline" onClick={() => setIsConfirmOpen(true)}>
              確認ダイアログを開く
            </Button>
            <Button variant="secondary" onClick={() => setIsTabbedModalOpen(true)}>
              タブ付きモーダルを開く
            </Button>
          </Flex>

          <Flex wrap="wrap" className="gap-3">
            <Button variant="accent" onClick={() => handleShowToast("success")}>成功トースト</Button>
            <Button variant="secondary" onClick={() => handleShowToast("info")}>
              インフォトースト
            </Button>
            <Button variant="destructive" onClick={() => handleShowToast("error")}>
              エラートースト
            </Button>
          </Flex>
        </Section>

        <Section
          as="section"
          className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm"
        >
          <Stack className="gap-2">
            <SecTitle as="h2">画像ビューアー</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              画像をクリックすると拡大表示されます。ImageViewerProvider でラップされた領域内で動作します。
            </Para>
          </Stack>
          <Flex wrap="wrap" className="gap-4">
            <ZoomableImage
              src={logoPath(business.logo)}
              alt="ロゴ"
              className="h-24 w-24 rounded border object-contain p-2"
            />
            <ZoomableImage
              src={logoPath(business.logo)}
              alt="ロゴ (大)"
              className="h-32 w-32 rounded border object-contain p-2"
            />
          </Flex>
        </Section>

        <Section
          as="section"
          className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm"
        >
          <Stack className="gap-2">
            <SecTitle as="h2">AppToast（アプリ用トースト）</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              画面中央または指定位置にリッチな通知を表示します。
              mode で自動消去（notification）か手動消去（persistent）を切り替えられます。
            </Para>
          </Stack>

          <Grid className="gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stack className="gap-2">
              <Label htmlFor="app-toast-variant">バリアント</Label>
              <SelectInput
                size="xs"
                id="app-toast-variant"
                className="w-full justify-between"
                options={[...APP_TOAST_VARIANTS]}
                value={appToastOptions.variant}
                showPlaceholderOption={false}
                onChange={(value) => setAppToastOptions((prev) => ({ ...prev, variant: value as ToastVariant }))}
              />
            </Stack>

            <Stack className="gap-2">
              <Label htmlFor="app-toast-position">位置</Label>
              <SelectInput
                size="xs"
                id="app-toast-position"
                className="w-full justify-between"
                options={[...APP_TOAST_POSITIONS]}
                value={appToastOptions.position}
                showPlaceholderOption={false}
                onChange={(value) => setAppToastOptions((prev) => ({ ...prev, position: value as ToastPosition }))}
              />
            </Stack>

            <Stack className="gap-2">
              <Label htmlFor="app-toast-mode">モード</Label>
              <SelectInput
                size="xs"
                id="app-toast-mode"
                className="w-full justify-between"
                options={[...APP_TOAST_MODES]}
                value={appToastOptions.mode}
                showPlaceholderOption={false}
                onChange={(value) => setAppToastOptions((prev) => ({ ...prev, mode: value as ToastMode }))}
              />
            </Stack>

            <Stack className="gap-2">
              <Label htmlFor="app-toast-size">サイズ</Label>
              <SelectInput
                size="xs"
                id="app-toast-size"
                className="w-full justify-between"
                options={[...APP_TOAST_SIZES]}
                value={appToastOptions.size}
                showPlaceholderOption={false}
                onChange={(value) => setAppToastOptions((prev) => ({ ...prev, size: value as ToastSize }))}
              />
            </Stack>

            <Stack className="gap-2">
              <Label htmlFor="app-toast-icon">アイコン</Label>
              <SelectInput
                size="xs"
                id="app-toast-icon"
                className="w-full justify-between"
                options={[...APP_TOAST_ICON_PRESETS]}
                value={appToastOptions.iconPreset}
                showPlaceholderOption={false}
                onChange={(value) => setAppToastOptions((prev) => ({ ...prev, iconPreset: value as "default" | ToastIconPreset }))}
              />
            </Stack>

            <Stack className="gap-2">
              <Label htmlFor="app-toast-duration">表示時間 (ms)</Label>
              <NumberInput
                id="app-toast-duration"
                min={1000}
                max={10000}
                step={500}
                value={appToastOptions.duration}
                onChange={(value) =>
                  setAppToastOptions((prev) => ({ ...prev, duration: value }))
                }
                disabled={appToastOptions.mode === "persistent"}
              />
            </Stack>

            <Stack className="gap-2">
              <Label htmlFor="app-toast-message">メッセージ</Label>
              <Input
                id="app-toast-message"
                placeholder="例: 処理が完了しました"
                value={appToastOptions.message}
                onChange={(event) =>
                  setAppToastOptions((prev) => ({ ...prev, message: event.target.value }))
                }
              />
            </Stack>

            <Flex align="end" className="gap-2 pb-1">
              <Label className="flex items-center gap-2">
                <BooleanCheckboxInput
                  value={appToastOptions.spinning}
                  onChange={(checked) =>
                    setAppToastOptions((prev) => ({
                      ...prev,
                      spinning: Boolean(checked),
                    }))
                  }
                />
                アイコン回転
              </Label>
            </Flex>
          </Grid>

          <Flex wrap="wrap" className="gap-3">
            <Button onClick={handleShowAppToast}>
              AppToast を表示
            </Button>
            {appToastOptions.mode === "persistent" && (
              <Button variant="outline" onClick={hideToast}>
                非表示にする
              </Button>
            )}
          </Flex>

          <Flex wrap="wrap" className="gap-3">
            <Button
              variant="accent"
              size="sm"
              onClick={() => showToast("保存しました", "success")}
            >
              成功
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => showToast("エラーが発生しました", "error")}
            >
              エラー
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => showToast("注意してください", "warning")}
            >
              警告
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => showToast("お知らせです", "info")}
            >
              情報
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                showToast({
                  message: "処理中...",
                  variant: "loading",
                  mode: "persistent",
                });
                setTimeout(() => hideToast(), 3000);
              }}
            >
              ローディング
            </Button>
          </Flex>

          <Flex wrap="wrap" className="gap-3">
            <Button
              size="sm"
              onClick={() => showToast("プライマリカラーの通知", "primary")}
            >
              Primary
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => showToast("セカンダリカラーの通知", "secondary")}
            >
              Secondary
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => showToast("アクセントカラーの通知", "accent")}
            >
              Accent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => showToast({
                message: "プライマリ色 + ローディングアイコン",
                variant: "primary",
                icon: "loading",
                spinning: true,
              })}
            >
              Primary + Loading Icon
            </Button>
          </Flex>
        </Section>

        <Grid className="gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <Section
            as="section"
            className="order-2 my-0 flex flex-col gap-6 rounded-lg border bg-background p-6 shadow-sm lg:order-1"
          >
            <SecTitle as="h2">オプション</SecTitle>
            <Stack className="gap-4">
              <Stack className="gap-2">
                <Label htmlFor="mode">モード</Label>
                <SelectInput
                  size="xs"
                  id="mode"
                  className="w-full justify-between"
                  options={[...MODES]}
                  value={options.mode}
                  showPlaceholderOption={false}
                  onChange={(value) => setOptions((prev) => ({ ...prev, mode: value as LoadingOverlayMode }))}
                />
              </Stack>

              <Stack className="gap-2">
                <Label htmlFor="overlay-class">className (オーバーレイ)</Label>
                <Input
                  id="overlay-class"
                  placeholder="例: bg-background/90"
                  value={options.className}
                  onChange={(event) =>
                    setOptions((prev) => ({ ...prev, className: event.target.value }))
                  }
                />
              </Stack>

              <Stack className="gap-2">
                <Label htmlFor="spinner-variant">spinnerVariant</Label>
                <SelectInput
                  size="xs"
                  id="spinner-variant"
                  className="w-full justify-between"
                  options={[...SPINNER_VARIANTS]}
                  value={options.spinnerVariant}
                  showPlaceholderOption={false}
                  onChange={(value) => setOptions((prev) => ({ ...prev, spinnerVariant: value as SpinnerVariant }))}
                />
              </Stack>

              <Stack className="gap-2">
                <Label htmlFor="spinner-class">spinnerClassName</Label>
                <Input
                  id="spinner-class"
                  placeholder="例: text-primary"
                  value={options.spinnerClassName}
                  onChange={(event) =>
                    setOptions((prev) => ({ ...prev, spinnerClassName: event.target.value }))
                  }
                />
              </Stack>

              <Stack className="gap-2">
                <Label className="gap-2">
                  <BooleanCheckboxInput
                    value={options.showMessage}
                    onChange={(checked) =>
                      setOptions((prev) => ({
                        ...prev,
                        showMessage: Boolean(checked),
                      }))
                    }
                  />
                  message を表示する
                </Label>
                <Stack className="gap-3 rounded-md border bg-muted/40 p-4">
                  <Stack className="gap-2">
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
                  </Stack>
                  <Stack className="gap-2">
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
                  </Stack>
                </Stack>
              </Stack>
            </Stack>
            <Button onClick={() => setIsVisible(true)} disabled={isVisible} className="self-start">
              {isVisible ? "表示中..." : "オーバーレイを表示 (5 秒間)"}
            </Button>
          </Section>

          <Stack className="gap-6">
            <Section
              as="section"
              className="order-1 my-0 flex flex-col gap-4 rounded-lg border bg-background p-6 shadow-sm lg:order-none"
            >
              <Stack className="gap-3">
                <SecTitle as="h2">プレビュー</SecTitle>
                <Para tone="muted" size="sm" className="mt-0">
                  ボタンを押してから 5 秒間、選択した設定で LoadingOverlay が表示されます。
                </Para>
              </Stack>
              <Block className="relative min-h-72 overflow-hidden rounded-xl border bg-background p-8 shadow-inner">
                <Block className="pointer-events-none select-none text-center text-sm text-muted-foreground">
                  <Para size="inherit" weight="inherit" align="inherit" className="my-0">ここにコンテンツが表示される想定です。</Para>
                  <Para size="inherit" weight="inherit" align="inherit" className="my-0">local モードの場合、この枠内にオーバーレイが表示されます。</Para>
                </Block>
                {isVisible ? <ScreenLoader {...overlayProps} /> : null}
              </Block>
            </Section>

          </Stack>
        </Grid>
      </Stack>

      <Modal open={isModalOpen} onOpenChange={setIsModalOpen} title="カスタムモーダル">
        <Stack className="gap-4">
          <Para className="mt-0">
            任意のコンテンツを含めることができる共通モーダルです。必要に応じてフォームや補足説明を配置し、操作完了後に閉じるよう制御します。
          </Para>
          <Button
            variant="outline"
            className="self-start"
            onClick={() => showToast({ message: "モーダルの上のトースト(押すと消え、モーダルは開いたまま)", variant: "info" })}
          >
            トーストを出す
          </Button>
          <Stack data-demo="stack-bench" className="gap-3 rounded border border-border p-3">
            <HelpTip label="重なりの確かめ" help="モーダルの中から開いた浮く物は、どれもモーダルの上に出ます" />
            <ComboboxInput
              value={stackComboValue}
              onChange={setStackComboValue}
              options={STACK_BENCH_OPTIONS}
              placeholder="長い候補の選択"
            />
            <SelectInput
              value={stackSelectValue}
              onChange={setStackSelectValue}
              options={STACK_BENCH_OPTIONS.slice(0, 12)}
              placeholder="選択の一覧"
            />
            <Popover trigger={<Button variant="outline" className="self-start">長い中身のポップオーバー</Button>} title="長い中身">
              <Stack className="gap-2">
                {STACK_BENCH_OPTIONS.map((o) => (
                  <Para key={o.value} className="m-0">{o.label}</Para>
                ))}
              </Stack>
            </Popover>
            <Button variant="outline" className="self-start" onClick={() => setIsStackConfirmOpen(true)}>
              確認を開く
            </Button>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => {
                setIsStackLoaderVisible(true);
                window.setTimeout(() => setIsStackLoaderVisible(false), 2000);
              }}
            >
              全画面の読み込み(2 秒)
            </Button>
          </Stack>
          <Button variant="secondary" className="self-start" onClick={() => setIsModalOpen(false)}>
            モーダルを閉じる
          </Button>
        </Stack>
      </Modal>

      <Dialog
        open={isStackConfirmOpen}
        onOpenChange={setIsStackConfirmOpen}
        title="モーダルの上の確認"
        description="後に開いたので、開いた元のモーダルより上に出ます"
        confirmLabel="OK"
        onConfirm={() => setIsStackConfirmOpen(false)}
      />
      {isStackLoaderVisible ? <ScreenLoader mode="fullscreen" message="全画面の読み込み(cover)" /> : null}

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
    </Block>
    </ImageViewerProvider>
  );
}
