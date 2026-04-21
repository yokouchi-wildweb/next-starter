"use client"

import { ReactNode, useRef, useState } from "react"
import {
  FadeSlider,
  type ArrowPosition,
  type ArrowSize,
  type ArrowVariant,
  type DotPosition,
  type DotVariant,
  type FadeTransition,
  type ResponsiveToggle,
  type SliderImperativeApi,
} from "@/components/Widgets"
import { Stack, Main } from "@/components/Layout"
import { SecTitle } from "@/components/TextBlocks"

const sampleSlides = [
  { id: 1, title: "スライド1", body: "クロスフェードでの切り替えを確認してください。", hue: 220 },
  { id: 2, title: "スライド2", body: "キーボードの ← → や水平スワイプでも動きます。", hue: 10 },
  { id: 3, title: "スライド3", body: "autoplay とホバー一時停止の挙動もテスト可能。", hue: 150 },
  { id: 4, title: "スライド4", body: "fadeThrough だと旧スライドが一旦消えてから新スライドが現れます。", hue: 300 },
]

function SampleSlide({ title, body, hue }: { title: ReactNode; body: ReactNode; hue: number }) {
  return (
    <div
      className="flex flex-col justify-center items-center rounded-lg p-10 text-white shadow-sm"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))`,
        minHeight: 260,
      }}
    >
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-center max-w-md">{body}</p>
    </div>
  )
}

type ResponsiveToggleOption = "true" | "false" | "sm" | "md" | "lg" | "xl" | "2xl"

function parseResponsiveToggle(value: ResponsiveToggleOption): ResponsiveToggle {
  if (value === "true") return true
  if (value === "false") return false
  return value
}

export default function DemoPage() {
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
      <Stack space={8} className="py-8">
        <SecTitle>FadeSlider デモ</SecTitle>

        <div className="rounded-lg border bg-muted/50 p-4 mb-8">
          <h3 className="text-sm font-semibold mb-4">設定パネル</h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm">transition</span>
              <select
                value={transition}
                onChange={(e) => setTransition(e.target.value as typeof transition)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="crossfade">crossfade</option>
                <option value="fadeThrough">fadeThrough</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">duration (ms)</span>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="400"
                className="rounded border px-2 py-1 text-sm bg-background"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">easing</span>
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
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">loop</span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">showArrows</span>
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
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">showDots</span>
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
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">arrowVariant</span>
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
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">arrowSize</span>
              <select
                value={arrowSize}
                onChange={(e) => setArrowSize(e.target.value as ArrowSize)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="sm">sm</option>
                <option value="md">md</option>
                <option value="lg">lg</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">arrowPosition</span>
              <select
                value={arrowPosition}
                onChange={(e) => setArrowPosition(e.target.value as ArrowPosition)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="inside">inside</option>
                <option value="outside">outside</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">dotVariant</span>
              <select
                value={dotVariant}
                onChange={(e) => setDotVariant(e.target.value as DotVariant)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="default">default</option>
                <option value="line">line</option>
                <option value="dash">dash</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">dotPosition</span>
              <select
                value={dotPosition}
                onChange={(e) => setDotPosition(e.target.value as DotPosition)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="bottom">bottom</option>
                <option value="inside-bottom">inside-bottom</option>
              </select>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">autoplay</span>
            </label>

            {autoplay && (
              <label className="flex flex-col gap-1">
                <span className="text-sm">autoplay delay (ms)</span>
                <input
                  type="text"
                  value={autoplayDelay}
                  onChange={(e) => setAutoplayDelay(e.target.value)}
                  placeholder="4000"
                  className="rounded border px-2 py-1 text-sm bg-background"
                />
              </label>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableKeyboard}
                onChange={(e) => setEnableKeyboard(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">enableKeyboard</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableSwipe}
                onChange={(e) => setEnableSwipe(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">enableSwipe</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pauseOnHover}
                onChange={(e) => setPauseOnHover(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">pauseOnHover</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={respectReducedMotion}
                onChange={(e) => setRespectReducedMotion(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">respectReducedMotion</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useControlled}
                onChange={(e) => setUseControlled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">controlled</span>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => sliderRef.current?.prev()}
              className="rounded border bg-background px-3 py-1 text-sm hover:bg-accent"
            >
              ref.prev()
            </button>
            <button
              type="button"
              onClick={() => sliderRef.current?.next()}
              className="rounded border bg-background px-3 py-1 text-sm hover:bg-accent"
            >
              ref.next()
            </button>
            <button
              type="button"
              onClick={() => sliderRef.current?.goTo(0)}
              className="rounded border bg-background px-3 py-1 text-sm hover:bg-accent"
            >
              ref.goTo(0)
            </button>
            <button
              type="button"
              onClick={() => sliderRef.current?.play()}
              className="rounded border bg-background px-3 py-1 text-sm hover:bg-accent"
            >
              ref.play()
            </button>
            <button
              type="button"
              onClick={() => sliderRef.current?.pause()}
              className="rounded border bg-background px-3 py-1 text-sm hover:bg-accent"
            >
              ref.pause()
            </button>
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            onIndexChange: {lastIndex !== null ? `スライド ${lastIndex + 1}` : "未変化"} / controlledIndex: {controlledIndex + 1}
          </div>
        </div>

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
