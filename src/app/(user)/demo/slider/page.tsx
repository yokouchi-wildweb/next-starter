"use client"

import { ReactNode, useState } from "react"
import { Slider, type ResponsiveToggle, type ArrowVariant, type ArrowSize, type ArrowPosition, type DotVariant, type DotPosition } from "@/components/Widgets"
import { Stack, Main } from "@/components/Layout"
import { SecTitle } from "@/components/TextBlocks"

const sampleItems = [
  { id: 1, title: "お知らせ1", description: "これはサンプルのお知らせです。" },
  { id: 2, title: "お知らせ2", description: "2つ目のお知らせの内容です。" },
  { id: 3, title: "お知らせ3", description: "3つ目のお知らせの内容です。" },
  { id: 4, title: "お知らせ4", description: "4つ目のお知らせの内容です。" },
]

function SampleCard({ title, description }: { title: ReactNode; description: ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-primary bg-primary/10 p-6 shadow-sm h-full">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-2 text-muted-foreground">{description}</div>
    </div>
  )
}

type PeekOption = "none" | "left" | "right" | "both"
type GapOption = "sm" | "md" | "lg"
type ArrowVariantOption = ArrowVariant
type ResponsiveToggleOption = "true" | "false" | "sm" | "md" | "lg" | "xl" | "2xl"

function parseResponsiveToggle(value: ResponsiveToggleOption): ResponsiveToggle {
  if (value === "true") return true
  if (value === "false") return false
  return value
}

export default function DemoPage() {
  const [showArrows, setShowArrows] = useState<ResponsiveToggleOption>("true")
  const [showDots, setShowDots] = useState<ResponsiveToggleOption>("true")
  const [loop, setLoop] = useState(false)
  const [peek, setPeek] = useState<PeekOption>("none")
  const [gap, setGap] = useState<GapOption>("md")
  const [containerWidth, setContainerWidth] = useState<string>("")
  const [arrowVariant, setArrowVariant] = useState<ArrowVariantOption>("light")
  const [arrowSize, setArrowSize] = useState<ArrowSize>("md")
  const [arrowPosition, setArrowPosition] = useState<ArrowPosition>("inside")
  const [dotVariant, setDotVariant] = useState<DotVariant>("default")
  const [dotPosition, setDotPosition] = useState<DotPosition>("bottom")
  const [slideSize, setSlideSize] = useState("85%")
  const [peekFade, setPeekFade] = useState(true)
  const [lastSlideIndex, setLastSlideIndex] = useState<number | null>(null)

  const peekValue = peek === "none" ? undefined : peek
  const containerWidthValue = containerWidth ? (isNaN(Number(containerWidth)) ? containerWidth : Number(containerWidth)) : undefined

  return (
    <Main>
      <Stack space={8} className="py-8">
        <SecTitle>CardSlider デモ</SecTitle>

        <div className="rounded-lg border bg-muted/50 p-4 mb-8">
          <h3 className="text-sm font-semibold mb-4">設定パネル</h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                <option value="xl">xl</option>
                <option value="2xl">2xl</option>
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
                <option value="xl">xl</option>
                <option value="2xl">2xl</option>
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
              <span className="text-sm">peek</span>
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
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">gap</span>
              <select
                value={gap}
                onChange={(e) => setGap(e.target.value as GapOption)}
                className="rounded border px-2 py-1 text-sm bg-background"
              >
                <option value="sm">sm</option>
                <option value="md">md</option>
                <option value="lg">lg</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">containerWidth</span>
              <input
                type="text"
                value={containerWidth}
                onChange={(e) => setContainerWidth(e.target.value)}
                placeholder="例: 400, 80%"
                className="rounded border px-2 py-1 text-sm bg-background"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm">arrowVariant</span>
              <select
                value={arrowVariant}
                onChange={(e) => setArrowVariant(e.target.value as ArrowVariantOption)}
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

            <label className="flex flex-col gap-1">
              <span className="text-sm">slideSize</span>
              <input
                type="text"
                value={slideSize}
                onChange={(e) => setSlideSize(e.target.value)}
                placeholder="例: 85%, 70%, 300px"
                className="rounded border px-2 py-1 text-sm bg-background"
              />
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={peekFade}
                onChange={(e) => setPeekFade(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">peekFade</span>
            </label>
          </div>

          {lastSlideIndex !== null && (
            <div className="mt-2 text-xs text-muted-foreground">
              onSlideChange: スライド {lastSlideIndex + 1} に移動
            </div>
          )}
        </div>

        <Slider
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
          peekFade={peekFade}
          onSlideChange={setLastSlideIndex}
        />
      </Stack>
    </Main>
  )
}
