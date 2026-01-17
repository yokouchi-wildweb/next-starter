// src/components/Feedback/Skeleton/FormSkeleton.tsx
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { BaseSkeleton } from "./BaseSkeleton";

type FormSkeletonProps = {
  fields?: number;
  includeButtons?: boolean;
  className?: string;
};

export function FormSkeleton({
  fields = 12,
  includeButtons = true,
      className,
}: FormSkeletonProps) {
  const placeholders = Array.from({ length: fields });
  return (
    <Block className={className}>
      {placeholders.map((_, i) => (
        <Stack key={i} space={4}>
          <BaseSkeleton className="h-4 w-20" />
          <BaseSkeleton className="h-10 w-full" />
        </Stack>
      ))}
      {includeButtons && (
        <div className="flex gap-2">
          <BaseSkeleton className="h-10 w-24" />
          <BaseSkeleton className="h-10 w-24" />
        </div>
      )}
    </Block>
  );
}
