"use client"

import { ReactNode, useState } from "react"
import { Slider } from "@/components/Widgets"
import { Block, Main } from "@/components/Layout"
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
type ArrowVariantOption = "light" | "dark"

export default function DemoPage() {
  const [showArrows, setShowArrows] = useState(true)
  const [showDots, setShowDots] = useState(true)
  const [loop, setLoop] = useState(false)
  const [peek, setPeek] = useState<PeekOption>("none")
  const [gap, setGap] = useState<GapOption>("md")
  const [containerWidth, setContainerWidth] = useState<string>("")
  const [arrowVariant, setArrowVariant] = useState<ArrowVariantOption>("light")

  const peekValue = peek === "none" ? undefined : peek
  const containerWidthValue = containerWidth ? (isNaN(Number(containerWidth)) ? containerWidth : Number(containerWidth)) : undefined

  return (
    <Main>
      <Block space="lg" className="py-8">
        <SecTitle>CardSlider デモ</SecTitle>

        <div className="rounded-lg border bg-muted/50 p-4 mb-8">
          <h3 className="text-sm font-semibold mb-4">設定パネル</h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showArrows}
                onChange={(e) => setShowArrows(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">showArrows</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDots}
                onChange={(e) => setShowDots(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">showDots</span>
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
              </select>
            </label>
          </div>
        </div>

        <Slider
          items={sampleItems}
          renderItem={(item) => (
            <SampleCard title={item.title} description={item.description} />
          )}
          showArrows={showArrows}
          showDots={showDots}
          loop={loop}
          peek={peekValue}
          gap={gap}
          containerWidth={containerWidthValue}
          arrowVariant={arrowVariant}
        />
      </Block>
    </Main>
  )
}
