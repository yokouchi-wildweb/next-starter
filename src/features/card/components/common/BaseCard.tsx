// src/features/card/components/common/BaseCard.tsx

import { cn } from "@/lib/cn";
import type { CardWithNames } from "@/features/card/entities";
import React from "react";
import { motion } from "framer-motion";

export type BaseCardProps = {
  card?: CardWithNames;
  index?: number; // x-indexは最も外側の要素に適用

  flipped?: boolean; // trueがオモテ面
  flipDegree?: number; // フリップの回転度数
  flipDuration?: number; // フリップの速度
  reverseFlip?: boolean; // フリップ方向の反転

  backImage?: number;
  className?: string;
  style?: React.CSSProperties;
  ratio?: "63/88" | "59/86";
};

const DEFAULT_FRONT_IMAGE = "/imgs/cards/dummy.png";
const CARD_BACK_IMAGES = [
  "/imgs/cards/card_back_1.png",
  "/imgs/cards/card_back_2.png",
  "/imgs/cards/card_back_3.png",
  "/imgs/cards/card_back_4.png",
];

export default function BaseCard({
  card,
  index,
  flipped = false,
  flipDegree = 180,
  flipDuration = 300,
  reverseFlip = false,
  backImage = 0,
  className,
  style,
  ratio = "63/88",
}: BaseCardProps) {

  const frontSrc = card?.mainImageUrl || DEFAULT_FRONT_IMAGE;
  const flipDir = reverseFlip ? flipDegree : -flipDegree;




  return (
    <div
      className="relative w-full drop-shadow-lg [perspective:1000px]"
      style={{
        zIndex: typeof index === "number" ? index : "auto",
      }}
    >
      <motion.div
        className={cn(`
          pointer-events-none
          relative
          w-full
          [transform-style:preserve-3d]
          `,
         className
        )}
        animate={{ rotateY: flipped ? 0 : flipDir }}
        initial={false}
        transition={{ duration: flipDuration / 1000 }}
        style={{
          ...style,
          aspectRatio: ratio,
        }}
      >
        <img
          src={frontSrc}
          alt={card?.name || "Dummy PresentationCard"}
          className="
          pointer-events-none
          block
          absolute
          inset-0
          w-full
          h-full
          object-cover
          [backface-visibility:hidden]
          "
        />
        <img
          src={CARD_BACK_IMAGES[backImage]}
          alt={`${card?.name || "Dummy PresentationCard"} 裏面`}
          className="
          pointer-events-none
          block
          absolute
          inset-0
          w-full
          h-full
          object-cover
          [backface-visibility:hidden]
          "
          style={{ transform: "rotateY(-180deg)" }}
        />
      </motion.div>
    </div>

  );
}
