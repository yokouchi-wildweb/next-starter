// src/app/(user)/demo/scroll-slider/_screen/DemoScrollSliderDemo.tsx
// /demo/scroll-slider のデモ本体(client)。Screen が描く。
"use client"

import { ReactNode, useRef, useState } from "react"
import {
  ScrollSlider,
  type ArrowPosition,
  type ArrowSize,
  type ArrowVariant,
  type DotPosition,
  type DotVariant,
  type ResponsiveToggle,
  type SliderImperativeApi,
} from "@/components/Widgets"
import { Block, Flex, Grid, Stack, Main } from "@/components/Layout"
import { SecTitle, Span } from "@/components/TextBlocks"
import { Button } from "@/components/Form/Button"
import { Label } from "@/components/Form/Label"

/** 欄を包む Label の class。Label の既定(横並びの中央寄せ・text-sm・leading-none・font-medium)を生の label の見た目に戻す */
const FIELD_LABEL_CLASS_NAME = "flex-col items-stretch gap-1 font-normal"
/** チェックボックスの行の Label の class(既定の横並び・中央寄せ・gap-2 はそのまま、太さだけ戻す) */
const CHECK_LABEL_CLASS_NAME = "cursor-pointer font-normal"
/** ref 操作のボタンの class(Button の既定の太さ font-medium を戻す) */
const REF_BUTTON_CLASS_NAME = "rounded border bg-background px-3 py-1 text-sm font-normal hover:bg-accent"

const sampleItems = [
  { id: 1, title: "お知らせ1", description: "これはサンプルのお知らせです。" },
  { id: 2, title: "お知らせ2", description: "2つ目のお知らせの内容です。" },
  { id: 3, title: "お知らせ3", description: "3つ目のお知らせの内容です。" },
  { id: 4, title: "お知らせ4", description: "4つ目のお知らせの内容です。" },
]

function SampleCard({ title, description }: { title: ReactNode; description: ReactNode }) {
  return (
    <Block className="rounded-lg border-2 border-primary bg-primary/10 p-6 shadow-sm h-full">
      <SecTitle as="h3" size="lg" weight="semiBold" align="inherit">
        {title}
      </SecTitle>
      <Block className="mt-2 text-muted-foreground">{description}</Block>
    </Block>
  )
}

type PeekOption = "none" | "left" | "right" | "both"
type GapOption = "sm" | "md" | "lg"
type ResponsiveToggleOption = "true" | "false" | "sm" | "md" | "lg" | "xl" | "2xl"

function parseResponsiveToggle(value: ResponsiveToggleOption): ResponsiveToggle {
  if (value === "true") return true
  if (value === "false") return false
  return value
}

export function DemoScrollSliderDemo() {
  const [showArrows, setShowArrows] = useState<ResponsiveToggleOption>("true")
  const [showDots, setShowDots] = useState<ResponsiveToggleOption>("true")
  const [loop, setLoop] = useState(false)
  const [peek, setPeek] = useState<PeekOption>("none")
  const [gap, setGap] = useState<GapOption>("md")
  const [containerWidth, setContainerWidth] = useState<string>("")
  const [arrowVariant, setArrowVariant] = useState<ArrowVariant>("light")
  const [arrowSize, setArrowSize] = useState<ArrowSize>("md")
  const [arrowPosition, setArrowPosition] = useState<ArrowPosition>("inside")
  const [dotVariant, setDotVariant] = useState<DotVariant>("default")
  const [dotPosition, setDotPosition] = useState<DotPosition>("bottom")
  const [slideSize, setSlideSize] = useState("85%")
  const [alignMode, setAlignMode] = useState<"auto" | "start" | "center" | "end" | "custom">("auto")
  const [alignValue, setAlignValue] = useState("0.15")
  const [maskEnabled, setMaskEnabled] = useState(true)
  const [maskLeft, setMaskLeft] = useState("10")
  const [maskRight, setMaskRight] = useState("10")
  const [autoplay, setAutoplay] = useState(false)
  const [autoplayDelay, setAutoplayDelay] = useState("4000")
  const [lastIndex, setLastIndex] = useState<number | null>(null)

  const sliderRef = useRef<SliderImperativeApi>(null)

  const peekValue = peek === "none" ? undefined : peek
  const containerWidthValue = containerWidth
    ? isNaN(Number(containerWidth))
      ? containerWidth
      : Number(containerWidth)
    : undefined

  return (
    <Main>
      <Stack gap="xl" className="py-8">
        <SecTitle>ScrollSlider デモ</SecTitle>

        <Block className="rounded-lg border bg-muted/50 p-4 mb-8">
          <SecTitle as="h3" size="sm" weight="semiBold" align="inherit" className="mb-4">
            設定パネル
          </SecTitle>

          <Grid columns="two" gap="md" className="md:grid-cols-3 lg:grid-cols-4">
            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">showArrows</Span>
              <select
                value={showArrows}
                onChange={(e) => setShowArrows(e.target.value as ResponsiveToggleOption)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="true">true</option>
                <option value="false">false</option>
                <option value="sm">sm</option>
                <option value="md">md</option>
                <option value="lg">lg</option>
                <option value="xl">xl</option>
                <option value="2xl">2xl</option>
              </select>
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">showDots</Span>
              <select
                value={showDots}
                onChange={(e) => setShowDots(e.target.value as ResponsiveToggleOption)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="true">true</option>
                <option value="false">false</option>
                <option value="sm">sm</option>
                <option value="md">md</option>
                <option value="lg">lg</option>
                <option value="xl">xl</option>
                <option value="2xl">2xl</option>
              </select>
            </Label>

            <Label className={CHECK_LABEL_CLASS_NAME}>
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                className="rounded"
              />
              <Span size="sm" weight="inherit">loop</Span>
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">peek</Span>
              <select
                value={peek}
                onChange={(e) => setPeek(e.target.value as PeekOption)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="none">none</option>
                <option value="left">left</option>
                <option value="right">right</option>
                <option value="both">both</option>
              </select>
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">gap</Span>
              <select
                value={gap}
                onChange={(e) => setGap(e.target.value as GapOption)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="sm">sm</option>
                <option value="md">md</option>
                <option value="lg">lg</option>
              </select>
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">containerWidth</Span>
              <input
                type="text"
                value={containerWidth}
                onChange={(e) => setContainerWidth(e.target.value)}
                placeholder="例: 400, 80%"
                className="rounded border px-2 py-1 text-sm bg-background"
              />
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">arrowVariant</Span>
              <select
                value={arrowVariant}
                onChange={(e) => setArrowVariant(e.target.value as ArrowVariant)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="light">light</option>
                <option value="dark">dark</option>
                <option value="outline">outline</option>
                <option value="ghost">ghost</option>
              </select>
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">arrowSize</Span>
              <select
                value={arrowSize}
                onChange={(e) => setArrowSize(e.target.value as ArrowSize)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="sm">sm</option>
                <option value="md">md</option>
                <option value="lg">lg</option>
              </select>
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">arrowPosition</Span>
              <select
                value={arrowPosition}
                onChange={(e) => setArrowPosition(e.target.value as ArrowPosition)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="inside">inside</option>
                <option value="outside">outside</option>
              </select>
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">dotVariant</Span>
              <select
                value={dotVariant}
                onChange={(e) => setDotVariant(e.target.value as DotVariant)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="default">default</option>
                <option value="line">line</option>
                <option value="dash">dash</option>
              </select>
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">dotPosition</Span>
              <select
                value={dotPosition}
                onChange={(e) => setDotPosition(e.target.value as DotPosition)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="bottom">bottom</option>
                <option value="inside-bottom">inside-bottom</option>
              </select>
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">slideSize</Span>
              <input
                type="text"
                value={slideSize}
                onChange={(e) => setSlideSize(e.target.value)}
                placeholder="例: 85%, 70%, 300px"
                className="rounded border px-2 py-1 text-sm bg-background"
              />
            </Label>

            <Label className={FIELD_LABEL_CLASS_NAME}>
              <Span size="sm" weight="inherit">align</Span>
              <select
                value={alignMode}
                onChange={(e) => setAlignMode(e.target.value as typeof alignMode)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="auto">auto (peek依存)</option>
                <option value="start">start</option>
                <option value="center">center</option>
                <option value="end">end</option>
                <option value="custom">数値指定</option>
              </select>
            </Label>

            {alignMode === "custom" && (
              <Label className={FIELD_LABEL_CLASS_NAME}>
                <Span size="sm" weight="inherit">align値 (0〜1)</Span>
                <input
                  type="text"
                  value={alignValue}
                  onChange={(e) => setAlignValue(e.target.value)}
                  placeholder="0.15"
                  className="rounded border px-2 py-1 text-sm bg-background"
                />
              </Label>
            )}

            <Label className={CHECK_LABEL_CLASS_NAME}>
              <input
                type="checkbox"
                checked={maskEnabled}
                onChange={(e) => setMaskEnabled(e.target.checked)}
                className="rounded"
              />
              <Span size="sm" weight="inherit">mask</Span>
            </Label>

            {maskEnabled && (
              <>
                <Label className={FIELD_LABEL_CLASS_NAME}>
                  <Span size="sm" weight="inherit">mask left (%)</Span>
                  <input
                    type="text"
                    value={maskLeft}
                    onChange={(e) => setMaskLeft(e.target.value)}
                    placeholder="10"
                    className="rounded border px-2 py-1 text-sm bg-background"
                  />
                </Label>

                <Label className={FIELD_LABEL_CLASS_NAME}>
                  <Span size="sm" weight="inherit">mask right (%)</Span>
                  <input
                    type="text"
                    value={maskRight}
                    onChange={(e) => setMaskRight(e.target.value)}
                    placeholder="10"
                    className="rounded border px-2 py-1 text-sm bg-background"
                  />
                </Label>
              </>
            )}

            <Label className={CHECK_LABEL_CLASS_NAME}>
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
                className="rounded"
              />
              <Span size="sm" weight="inherit">autoplay</Span>
            </Label>

            {autoplay && (
              <Label className={FIELD_LABEL_CLASS_NAME}>
                <Span size="sm" weight="inherit">autoplay delay (ms)</Span>
                <input
                  type="text"
                  value={autoplayDelay}
                  onChange={(e) => setAutoplayDelay(e.target.value)}
                  placeholder="4000"
                  className="rounded border px-2 py-1 text-sm bg-background"
                />
              </Label>
            )}
          </Grid>

          <Flex wrap="wrap" gap="xs" className="mt-4">
            <Button
              type="button"
              variant="none"
              size="none"
              onClick={() => sliderRef.current?.prev()}
              className={REF_BUTTON_CLASS_NAME}
            >
              ref.prev()
            </Button>
            <Button
              type="button"
              variant="none"
              size="none"
              onClick={() => sliderRef.current?.next()}
              className={REF_BUTTON_CLASS_NAME}
            >
              ref.next()
            </Button>
            <Button
              type="button"
              variant="none"
              size="none"
              onClick={() => sliderRef.current?.goTo(0)}
              className={REF_BUTTON_CLASS_NAME}
            >
              ref.goTo(0)
            </Button>
            <Button
              type="button"
              variant="none"
              size="none"
              onClick={() => sliderRef.current?.play()}
              className={REF_BUTTON_CLASS_NAME}
            >
              ref.play()
            </Button>
            <Button
              type="button"
              variant="none"
              size="none"
              onClick={() => sliderRef.current?.pause()}
              className={REF_BUTTON_CLASS_NAME}
            >
              ref.pause()
            </Button>
          </Flex>

          {lastIndex !== null && (
            <Block className="mt-2 text-xs text-muted-foreground">
              onIndexChange: スライド {lastIndex + 1} に移動
            </Block>
          )}
        </Block>

        <ScrollSlider
          ref={sliderRef}
          items={sampleItems}
          renderItem={(item) => (
            <SampleCard title={item.title} description={item.description} />
          )}
          showArrows={parseResponsiveToggle(showArrows)}
          showDots={parseResponsiveToggle(showDots)}
          loop={loop}
          peek={peekValue}
          gap={gap}
          containerWidth={containerWidthValue}
          arrowVariant={arrowVariant}
          arrowSize={arrowSize}
          arrowPosition={arrowPosition}
          dotVariant={dotVariant}
          dotPosition={dotPosition}
          slideSize={slideSize}
          align={
            alignMode === "auto"
              ? undefined
              : alignMode === "custom"
              ? Number(alignValue) || 0
              : alignMode
          }
          mask={maskEnabled ? { left: Number(maskLeft) || 0, right: Number(maskRight) || 0 } : false}
          autoplay={autoplay ? { delay: Number(autoplayDelay) || 4000 } : undefined}
          onIndexChange={setLastIndex}
        />
      </Stack>
    </Main>
  )
}
