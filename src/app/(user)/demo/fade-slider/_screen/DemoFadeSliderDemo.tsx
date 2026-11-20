// src/app/(user)/demo/fade-slider/_screen/DemoFadeSliderDemo.tsx
// /demo/fade-slider のデモ本体(client)。Screen が描く。
"use client"

import { ReactNode, useRef, useState } from "react"
import { FadeSlider, type FadeTransition } from "@/components/Widgets/FadeSlider"
import { type ArrowPosition, type ArrowSize, type ArrowVariant, type DotPosition, type DotVariant, type ResponsiveToggle, type SliderImperativeApi } from "@/components/Widgets/_shared/types"
import { Button } from "@/components/Button/Button"
import { Label } from "@/components/Input/Label"
import { BooleanCheckboxInput } from "@/components/Input/BooleanCheckboxInput"
import { Input } from "@/components/Input/Input"
import { Block } from "@/components/Layout/Block"
import { Flex } from "@/components/Layout/Flex"
import { Grid } from "@/components/Layout/Grid"
import { Stack } from "@/components/Layout/Stack"
import { Main } from "@/components/Layout/Main"
import { Para } from "@/components/TextBlocks/Para"
import { SecTitle } from "@/components/TextBlocks/SecTitle"
import { Span } from "@/components/TextBlocks/Span"

const sampleSlides = [
  { id: 1, title: "スライド1", body: "クロスフェードでの切り替えを確認してください。", hue: 220 },
  { id: 2, title: "スライド2", body: "キーボードの ← → や水平スワイプでも動きます。", hue: 10 },
  { id: 3, title: "スライド3", body: "autoplay とホバー一時停止の挙動もテスト可能。", hue: 150 },
  { id: 4, title: "スライド4", body: "fadeThrough だと旧スライドが一旦消えてから新スライドが現れます。", hue: 300 },
]

function SampleSlide({ title, body, hue }: { title: ReactNode; body: ReactNode; hue: number }) {
  return (
    <Flex
      direction="column"
      justify="center"
      align="center"
      className="rounded-lg p-10 text-white shadow-sm"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))`,
        minHeight: 260,
      }}
    >
      <SecTitle as="h3" size="xxl" weight="semiBold" align="inherit">{title}</SecTitle>
      <Para align="center" className="mt-3 mb-0 max-w-md">{body}</Para>
    </Flex>
  )
}

type ResponsiveToggleOption = "true" | "false" | "sm" | "md" | "lg" | "xl" | "2xl"

function parseResponsiveToggle(value: ResponsiveToggleOption): ResponsiveToggle {
  if (value === "true") return true
  if (value === "false") return false
  return value
}

export function DemoFadeSliderDemo() {
  const [transition, setTransition] = useState<"crossfade" | "fadeThrough">("crossfade")
  const [duration, setDuration] = useState("400")
  const [easing, setEasing] = useState("ease-in-out")
  const [loop, setLoop] = useState(true)
  const [showArrows, setShowArrows] = useState<ResponsiveToggleOption>("true")
  const [showDots, setShowDots] = useState<ResponsiveToggleOption>("true")
  const [arrowVariant, setArrowVariant] = useState<ArrowVariant>("light")
  const [arrowSize, setArrowSize] = useState<ArrowSize>("md")
  const [arrowPosition, setArrowPosition] = useState<ArrowPosition>("inside")
  const [dotVariant, setDotVariant] = useState<DotVariant>("default")
  const [dotPosition, setDotPosition] = useState<DotPosition>("bottom")
  const [autoplay, setAutoplay] = useState(false)
  const [autoplayDelay, setAutoplayDelay] = useState("4000")
  const [enableKeyboard, setEnableKeyboard] = useState(true)
  const [enableSwipe, setEnableSwipe] = useState(true)
  const [pauseOnHover, setPauseOnHover] = useState(true)
  const [respectReducedMotion, setRespectReducedMotion] = useState(true)
  const [useControlled, setUseControlled] = useState(false)
  const [controlledIndex, setControlledIndex] = useState(0)
  const [lastIndex, setLastIndex] = useState<number | null>(null)
  const sliderRef = useRef<SliderImperativeApi>(null)

  const transitionProp: FadeTransition = transition

  return (
    <Main>
      <Stack gap="xl" className="py-8">
        <SecTitle>FadeSlider デモ</SecTitle>

        <Block className="rounded-lg border bg-muted/50 p-4 mb-8">
          <SecTitle as="h3" size="sm" weight="semiBold" align="inherit" className="mb-4">設定パネル</SecTitle>

          <Grid columns="two" gap="md" className="md:grid-cols-3 lg:grid-cols-4">
            <Label className="flex flex-col items-stretch gap-1 font-normal">
              <Span size="sm">transition</Span>
              <select
                value={transition}
                onChange={(e) => setTransition(e.target.value as typeof transition)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="crossfade">crossfade</option>
                <option value="fadeThrough">fadeThrough</option>
              </select>
            </Label>

            <Label className="flex flex-col items-stretch gap-1 font-normal">
              <Span size="sm">duration (ms)</Span>
              <Input
                type="text"
                size="xs"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="400"
              />
            </Label>

            <Label className="flex flex-col items-stretch gap-1 font-normal">
              <Span size="sm">easing</Span>
              <select
                value={easing}
                onChange={(e) => setEasing(e.target.value)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="ease-in-out">ease-in-out</option>
                <option value="ease">ease</option>
                <option value="ease-in">ease-in</option>
                <option value="ease-out">ease-out</option>
                <option value="linear">linear</option>
              </select>
            </Label>

            <BooleanCheckboxInput value={loop} onChange={(checked) => setLoop(Boolean(checked))} label={<Span size="sm">loop</Span>} />

            <Label className="flex flex-col items-stretch gap-1 font-normal">
              <Span size="sm">showArrows</Span>
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
              </select>
            </Label>

            <Label className="flex flex-col items-stretch gap-1 font-normal">
              <Span size="sm">showDots</Span>
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
              </select>
            </Label>

            <Label className="flex flex-col items-stretch gap-1 font-normal">
              <Span size="sm">arrowVariant</Span>
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

            <Label className="flex flex-col items-stretch gap-1 font-normal">
              <Span size="sm">arrowSize</Span>
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

            <Label className="flex flex-col items-stretch gap-1 font-normal">
              <Span size="sm">arrowPosition</Span>
              <select
                value={arrowPosition}
                onChange={(e) => setArrowPosition(e.target.value as ArrowPosition)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="inside">inside</option>
                <option value="outside">outside</option>
              </select>
            </Label>

            <Label className="flex flex-col items-stretch gap-1 font-normal">
              <Span size="sm">dotVariant</Span>
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

            <Label className="flex flex-col items-stretch gap-1 font-normal">
              <Span size="sm">dotPosition</Span>
              <select
                value={dotPosition}
                onChange={(e) => setDotPosition(e.target.value as DotPosition)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="bottom">bottom</option>
                <option value="inside-bottom">inside-bottom</option>
              </select>
            </Label>

            <BooleanCheckboxInput value={autoplay} onChange={(checked) => setAutoplay(Boolean(checked))} label={<Span size="sm">autoplay</Span>} />

            {autoplay && (
              <Label className="flex flex-col items-stretch gap-1 font-normal">
                <Span size="sm">autoplay delay (ms)</Span>
                <Input
                  type="text"
                  size="xs"
                  value={autoplayDelay}
                  onChange={(e) => setAutoplayDelay(e.target.value)}
                  placeholder="4000"
                />
              </Label>
            )}

            <BooleanCheckboxInput value={enableKeyboard} onChange={(checked) => setEnableKeyboard(Boolean(checked))} label={<Span size="sm">enableKeyboard</Span>} />

            <BooleanCheckboxInput value={enableSwipe} onChange={(checked) => setEnableSwipe(Boolean(checked))} label={<Span size="sm">enableSwipe</Span>} />

            <BooleanCheckboxInput value={pauseOnHover} onChange={(checked) => setPauseOnHover(Boolean(checked))} label={<Span size="sm">pauseOnHover</Span>} />

            <BooleanCheckboxInput value={respectReducedMotion} onChange={(checked) => setRespectReducedMotion(Boolean(checked))} label={<Span size="sm">respectReducedMotion</Span>} />

            <BooleanCheckboxInput value={useControlled} onChange={(checked) => setUseControlled(Boolean(checked))} label={<Span size="sm">controlled</Span>} />
          </Grid>

          <Flex wrap="wrap" gap="xs" className="mt-4">
            <Button
              variant="none"
              size="none"
              propagateClick
              type="button"
              onClick={() => sliderRef.current?.prev()}
              className="rounded border bg-background px-3 py-1 text-sm font-normal hover:bg-accent"
            >
              ref.prev()
            </Button>
            <Button
              variant="none"
              size="none"
              propagateClick
              type="button"
              onClick={() => sliderRef.current?.next()}
              className="rounded border bg-background px-3 py-1 text-sm font-normal hover:bg-accent"
            >
              ref.next()
            </Button>
            <Button
              variant="none"
              size="none"
              propagateClick
              type="button"
              onClick={() => sliderRef.current?.goTo(0)}
              className="rounded border bg-background px-3 py-1 text-sm font-normal hover:bg-accent"
            >
              ref.goTo(0)
            </Button>
            <Button
              variant="none"
              size="none"
              propagateClick
              type="button"
              onClick={() => sliderRef.current?.play()}
              className="rounded border bg-background px-3 py-1 text-sm font-normal hover:bg-accent"
            >
              ref.play()
            </Button>
            <Button
              variant="none"
              size="none"
              propagateClick
              type="button"
              onClick={() => sliderRef.current?.pause()}
              className="rounded border bg-background px-3 py-1 text-sm font-normal hover:bg-accent"
            >
              ref.pause()
            </Button>
          </Flex>

          <Block className="mt-2 text-xs text-muted-foreground">
            onIndexChange: {lastIndex !== null ? `スライド ${lastIndex + 1}` : "未変化"} / controlledIndex: {controlledIndex + 1}
          </Block>
        </Block>

        <FadeSlider
          ref={sliderRef}
          items={sampleSlides}
          renderItem={(s) => <SampleSlide title={s.title} body={s.body} hue={s.hue} />}
          transition={transitionProp}
          duration={Number(duration) || 400}
          easing={easing}
          loop={loop}
          showArrows={parseResponsiveToggle(showArrows)}
          showDots={parseResponsiveToggle(showDots)}
          arrowVariant={arrowVariant}
          arrowSize={arrowSize}
          arrowPosition={arrowPosition}
          dotVariant={dotVariant}
          dotPosition={dotPosition}
          autoplay={autoplay ? { delay: Number(autoplayDelay) || 4000 } : undefined}
          enableKeyboard={enableKeyboard}
          enableSwipe={enableSwipe}
          pauseOnHover={pauseOnHover}
          respectReducedMotion={respectReducedMotion}
          {...(useControlled
            ? { index: controlledIndex, onIndexChange: setControlledIndex }
            : { onIndexChange: setLastIndex })}
        />
      </Stack>
    </Main>
  )
}
