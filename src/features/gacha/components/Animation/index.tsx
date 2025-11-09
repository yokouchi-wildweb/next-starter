// src/features/gacha/components/Animation/index.tsx

"use client";

import { useMachine } from "@xstate/react";
import { createAnimationMachine } from "@/features/gacha/machines/animationMachine";
import { useEffect, useMemo } from "react";
import FullScreen from "@/components/Layout/FullScreen";
import { useGachaResult } from "@/stores/useGachaResult";
import Performance from "./Performance";
import { Result } from "@/features/gacha/components/Animation/Result";
import { stateValueToString } from "@/features/gacha/machines/animationMachine/utils";
import { Section } from "@/components/TextBlocks";


// デバッグ用フェーズ表示ボックス
function DebugPhaseBox({ phase }: { phase: string }) {
  return (
    <div className="fixed top-4 left-4 z-50 rounded bg-blue-400 px-4 py-2 text-white">
      {phase}
    </div>
  );
}


// ガチャ演出のメインコンポーネント
export default function Animation() {

  const { cards: rawCards } = useGachaResult();
  const cards = useMemo(() => rawCards ?? [], [rawCards]);
  // const cards = dummyCards;

  // 状態マシンを使ってフェーズを管理する
  // マシンを再生成するとサービスが再初期化されてしまうため
  // カード一覧が変わった時のみ生成する
  const machine = useMemo(() => createAnimationMachine(cards), [cards]);
  const [state, send] = useMachine(machine);

  // 完了状態になったら結果ページへ遷移
  // useEffect(() => {
  //   if (state.matches("done")) {
  //     window.location.href = "/gacha/complete";
  //   }
  // }, [state]);

  return (
    <Section variant="plain">
      {/* スマホブラウザ等でも画面の高さに合わせるコンテナ */}
      <FullScreen
        className={`bg-black`}
      >
        <DebugPhaseBox phase={stateValueToString(state)} />

        {state.matches("performance") && (
          <Performance
            state={state}
            send={send}
          />
        )}

        {state.matches("result") && (
          <Result
            state={state}
            send={send}
            cards={cards}
          />
        )}

      </FullScreen>
    </Section>
  );
}
