// src/features/card/components/common/InteractiveDecoratedCard.tsx

"use client";

import { useGesture } from "@use-gesture/react";
import type { DragState, PinchState } from "@use-gesture/react";
import { animate, motion, useMotionValue } from "framer-motion";
import DecoratedCard, { type DecoratedCardProps } from "./DecoratedCard";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";



export type InteractiveDecoratedCardProps = DecoratedCardProps & {
  enableTouchMove?: boolean;
  enableTouchScale?: boolean;
  parentScale?: number;
  onInteract?: (index?: number) => void;
  onDrag?: (state: DragState) => void;
  onDragStart?: (state: DragState) => void;
  onDragEnd?: (state: DragState) => void;
  onPinch?: (state: PinchState) => void;
  onPinchStart?: (state: PinchState) => void;
  onPinchEnd?: (state: PinchState) => void;

  externalX?: number;
  externalY?: number;
};

export default function InteractiveDecoratedCard({

    className, // 下位にリレーせず自身に適用
    index, // 使用した上で下位にリレー
    enableTouchMove = false,
    enableTouchScale = false,
    parentScale = 1,
    onInteract,
    onDrag,
    onDragStart,
    onDragEnd,
    onPinch,
    onPinchStart,
    onPinchEnd,

    externalX = 0,
    externalY = 0,

    ...rest
  }: InteractiveDecoratedCardProps) {

  // カードの現在位置を管理
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  useEffect(() => {
    if (externalX !== undefined) {
      animate(x, externalX, { duration: 0.5 });
    }
  }, [externalX]);

  useEffect(() => {
    if (externalY !== undefined) {
      animate(y, externalY, { duration: 0.5 });
    }
  }, [externalY]);

  const [touchScaleEnabled] = useState(enableTouchScale);

  // 各種ジェスチャーを処理するハンドラ
  const bind = useGesture(
    {
      onDrag: (state) => {
        onDrag?.(state);

        if (enableTouchMove) {
          const [dx, dy] = state.delta;
          x.set(x.get() + dx / parentScale);
          y.set(y.get() + dy / parentScale);
        }
      },
      onDragStart: (state) => {
        onInteract?.(index);
        onDragStart?.(state);
      },
      onDragEnd: (state) => {
        onDragEnd?.(state);
      },
      onPinch: (state) => {
        onPinch?.(state);

        if (touchScaleEnabled) {
          const [d] = state.offset;
          scale.set(1 + d / 200);
        }
      },
      onPinchStart: (state) => {
        onInteract?.(index);
        onPinchStart?.(state);
      },
      onPinchEnd: (state) => {
        onPinchEnd?.(state);
      },
    },
    {
      drag: { from: () => [x.get(), y.get()] },
      pinch: { from: () => [(scale.get() - 1) * 200, 0] },
      eventOptions: { passive: false },
    }
  );

  return (

    <motion.div
      {...(bind() as any)}
      // 親でタッチイベンっとが無効になっている場合の対策
      className={cn(`pointer-events-auto`, className)}
      style={{
        x, y, scale, // useGestureで更新される値を適用
        touchAction: "none",
      }}
      onClick={() => onInteract?.(index)}>

        <DecoratedCard
          index={index}
          {...rest}
        />
    </motion.div>
  );
}

