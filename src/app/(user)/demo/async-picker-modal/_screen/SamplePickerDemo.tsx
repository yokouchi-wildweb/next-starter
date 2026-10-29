"use client";

// src/app/(user)/demo/async-picker-modal/_screen/SamplePickerDemo.tsx
//
// AsyncPickerModal の動作確認。複数選択（追加済みは選択不可）と単一選択（行クリックで即確定）。

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/Form/Button/Button";
import { type Options } from "@/components/Form/types";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { AsyncPickerModal } from "@/components/Overlays/AsyncPickerModal";
import { Para, SecTitle, Span } from "@/components/TextBlocks";
import type { Sample } from "@/features/sample/entities/model";
import { sampleClient } from "@/features/sample/services/client/sampleClient";
import { useToast } from "@/lib/toast";

const getOptionFromResult = (item: Sample): Options => ({ value: item.id, label: item.name });

export function SamplePickerDemo() {
  const { showToast } = useToast();
  const [added, setAdded] = useState<Sample[]>([]);
  const [multiOpen, setMultiOpen] = useState(false);
  const [singleOpen, setSingleOpen] = useState(false);
  const [lastSingle, setLastSingle] = useState<Sample | null>(null);

  const searchFn = useMemo(() => sampleClient.search!, []);
  const addedIds = useMemo(() => added.map((s) => s.id), [added]);

  const handleConfirmMulti = useCallback(
    async (_values: unknown, items: Sample[]) => {
      // 実アプリではここで API 呼び出し（在庫追加等）。デモは擬似待ち時間でローディング表示を確認する
      await new Promise((resolve) => setTimeout(resolve, 600));
      setAdded((prev) => [...prev, ...items]);
      showToast(`${items.length}件を追加しました`, "success");
    },
    [showToast],
  );

  const handleConfirmSingle = useCallback(
    async (_values: unknown, items: Sample[]) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setLastSingle(items[0] ?? null);
    },
    [],
  );

  return (
    <Stack space={8}>
      <Stack space={3}>
        <SecTitle>複数選択（追加済みは選択不可）</SecTitle>
        <Flex gap="xs" align="center">
          <Button type="button" onClick={() => setMultiOpen(true)}>
            サンプルを追加
          </Button>
          <Button type="button" variant="outline" onClick={() => setAdded([])} disabled={added.length === 0}>
            リストをクリア
          </Button>
        </Flex>
        {added.length === 0 ? (
          <Para size="sm" tone="muted">まだ追加されていません</Para>
        ) : (
          <Stack space={1}>
            {added.map((s) => (
              <Span key={s.id} size="sm">
                {s.name}
                {s.description ? (
                  <Span size="xs" tone="muted" className="ml-2">{s.description}</Span>
                ) : null}
              </Span>
            ))}
          </Stack>
        )}
        <AsyncPickerModal<Sample>
          open={multiOpen}
          onOpenChange={setMultiOpen}
          title="サンプルを選択"
          description="検索欄に入力して Enter で検索。空のまま下へスクロールすると全件を順に読み込みます。"
          searchFn={searchFn}
          getOptionFromResult={getOptionFromResult}
          searchFields={["name", "description"]}
          disabledValues={addedIds}
          renderOption={(option, item) => (
            <Stack space={0}>
              <Span size="sm" className="truncate">{option.label}</Span>
              {item?.description ? (
                <Span size="xs" tone="muted" className="truncate">{item.description}</Span>
              ) : null}
            </Stack>
          )}
          onConfirm={handleConfirmMulti}
        />
      </Stack>

      <Stack space={3}>
        <SecTitle>単一選択（行クリックで即確定）</SecTitle>
        <Flex gap="xs" align="center">
          <Button type="button" variant="outline" onClick={() => setSingleOpen(true)}>
            1件選ぶ
          </Button>
          <Span size="sm" tone="muted">
            {lastSingle ? `選択: ${lastSingle.name}` : "未選択"}
          </Span>
        </Flex>
        <AsyncPickerModal<Sample>
          open={singleOpen}
          onOpenChange={setSingleOpen}
          title="サンプルを1件選択"
          multiple={false}
          searchFn={searchFn}
          getOptionFromResult={getOptionFromResult}
          searchFields={["name"]}
          onConfirm={handleConfirmSingle}
        />
      </Stack>
    </Stack>
  );
}
