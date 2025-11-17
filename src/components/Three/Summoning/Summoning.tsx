// src/components/Three/Summoning/Summoning.tsx
// 初心者向けコメント: 外部からはこのコンポーネントを呼び出すだけで
// 魔法陣の演出を表示できます。処理の詳細は Scene コンポーネントに任せています。

"use client";

import { Canvas } from "@react-three/fiber";
import Scene from "./Scene";

export default function Summoning() {
  return (
    <>
      {/* Three.js 用の Canvas を配置 */}
      {/* サイズ不足で端が切れてしまうのを防ぐため width/height を明示 */}
      <Canvas className="absolute inset-0 w-full h-full bg-black">
        <Scene />
      </Canvas>
    </>
  );
}
