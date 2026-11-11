import { cn } from "@/lib/cn"

/** 印(data-slot)。image-viewer-skeleton は上流の包む部品(画像ビューアの読み込み中)が渡す。fork は名前を変えずに印を狙う */
export type SkeletonSlot = "skeleton" | "image-viewer-skeleton";

type SkeletonProps = Omit<React.ComponentProps<"div">, "slot"> & {
  /** 印の名前(上流の包む部品だけが使う。既定 skeleton)。props の data-slot はこれに負ける */
  slot?: SkeletonSlot;
};

function Skeleton({ className, slot = "skeleton", ...props }: SkeletonProps) {
  return (
    <div
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
      data-slot={slot}
    />
  )
}

export { Skeleton }
