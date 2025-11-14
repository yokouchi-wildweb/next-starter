// src/components/Three/Summoning/Materials/star.ts

// 星粒子の見た目を定義するマテリアルを生成します。
// 頂点・フラグメントシェーダ内の数値を調整すると、星の形状や色味を変更できます。

import * as THREE from "three";
import { settings } from "../settings";

// 星を描画するための ShaderMaterial を返します
export function createStarMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      // 色を外部から変更できるよう uniform にする
      color: { value: new THREE.Color(0xffffff) },
      // 星サイズ調整用の係数
      sizeFactor: { value: settings.stars.sizeFactor },
    },
    vertexShader: `
      // time を受け取り星の明滅に使用
      uniform float time;
      // 星サイズ調整用の係数
      uniform float sizeFactor;
      varying vec3 vPos;
      void main() {
        vPos = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        // 距離に応じてサイズを変える
        gl_PointSize = 30.0 * sizeFactor / -mvPosition.z;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec3 vPos;
      // 星形を作る関数。十字と45度回転させた十字を重ね合わせることで
      // 単純な8方向の星形を作り出す
      float shape(vec2 uv) {
        uv = abs(uv);
        // 通常の十字
        float d1 = max(uv.x, uv.y);
        float cross1 = smoothstep(0.5, 0.2, d1);
        // 45度回転させた十字
        float d2 = max(abs(uv.x + uv.y), abs(uv.x - uv.y)) * 0.7071;
        float cross2 = smoothstep(0.5, 0.2, d2);
        // 中心部分を少し丸める
        float center = smoothstep(0.3, 0.0, length(uv));
        return max(max(cross1, cross2), center);
      }
      void main() {
        // gl_PointCoord を -1..1 の範囲へ変換
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float s = shape(uv);
        if (s <= 0.0) discard;
        // tw を操作すると明滅の速度や色味が変わります
        float tw = sin(time * 3.0 + vPos.y * 10.0) * 0.5 + 0.5;
        // uniform で受け取った色に明滅を適用
        gl_FragColor = vec4(color * tw, s);
      }
    `,
  });
}
