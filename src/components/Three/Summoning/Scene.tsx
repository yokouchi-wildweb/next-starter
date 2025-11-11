// src/components/Three/Summoning/Scene.tsx

"use client";

import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import {
  createStarMaterial,
  createLightningMaterial,
  createSparkMaterial,
  createCircleMaterial,
  createCylinderMaterial,
} from "./Materials";
import { createParticles } from "./particles";
// 演出タイミングをまとめた設定を読み込みます
import { settings } from "./settings";
import {
  updateCamera,
  updateStars,
  updateRing,
  updateCylinder,
  updateLightning,
  updateLight,
} from "./Updaters";

// 落雷エフェクトが終了する時刻を事前に計算
const lightningEnd = settings.lightning.start + settings.lightning.interval * settings.lightning.count;

export default function Scene() {
  const group = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const cylinder = useRef<THREE.Mesh>(null!);
  const stars = useRef<THREE.Points>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const overlay = useRef<THREE.Mesh>(null!);
  const lightning = useRef<THREE.Mesh>(null!);
  const spark = useRef<THREE.Mesh>(null!);
  // 落雷位置や角度の配列は初期値を入れておく
  const strikeOffsets = useRef<THREE.Vector3[]>([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
  const strikeRots = useRef<number[]>([0, 0, 0]);

  // ジオメトリやマテリアルは useMemo で一度だけ生成
  const particles = useMemo(() => createParticles(), []);
  const start = useRef<number>(0);
  const starMaterial = useMemo(() => createStarMaterial(), []);
  const lightningMaterial = useMemo(() => createLightningMaterial(), []);
  const sparkMaterial = useMemo(() => createSparkMaterial(), []);
  const circleMaterial = useMemo(() => createCircleMaterial(), []);
  const cylinderMaterial = useMemo(() => createCylinderMaterial(), []);


  // 初期化処理
  // 開始時間と落雷位置をランダムに設定するだけなので短い
  useEffect(() => {
    start.current = performance.now();
    strikeOffsets.current = Array.from(
      { length: settings.lightning.count },
      () => new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6),
    );
    strikeRots.current = Array.from({ length: settings.lightning.count }, () => (Math.random() - 0.5) * 0.4);

    (starMaterial as THREE.ShaderMaterial).uniforms.color.value.set(settings.stars.startColor);
    (circleMaterial as THREE.ShaderMaterial).uniforms.color.value.set(settings.ring.startColor);
    (cylinderMaterial as THREE.ShaderMaterial).uniforms.color.value.set(settings.cylinder.startColor);
    (overlay.current?.material as THREE.MeshBasicMaterial)?.color.set(settings.overlay.startColor);
  }, []);

  // 毎フレーム実行されるアニメーション処理
  // 時刻 t を基に各オブジェクトの状態を更新します
  useFrame(({ camera }) => {
    const t = (performance.now() - start.current) / 1000;
    (starMaterial as THREE.ShaderMaterial).uniforms.time.value = t;
    (lightningMaterial as THREE.ShaderMaterial).uniforms.time.value = t;
    (circleMaterial as THREE.ShaderMaterial).uniforms.time.value = t;
    (cylinderMaterial as THREE.ShaderMaterial).uniforms.time.value = t;

    updateCamera(camera, overlay.current, t);
    // 星空の回転軸方向は settings で指定できます
    updateStars(stars.current, t);
    updateRing(ring.current, t);
    updateCylinder(cylinder.current, t);
    updateLightning(
      lightning.current,
      spark.current,
      strikeOffsets.current,
      strikeRots.current,
      t,
    );
    updateLight(light.current, t);
  });

  return (
    <>
      <group ref={group}>
        <points ref={stars} geometry={particles.geometry} material={starMaterial} />

        <mesh ref={ring} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <planeGeometry args={[3.4, 3.4]} />
          <primitive object={circleMaterial} attach="material" />
        </mesh>

        <mesh ref={cylinder} position={[0, 1, 0]} visible={false}>
          <cylinderGeometry args={[1, 1, 2, 64, 1, true]} />
          <primitive object={cylinderMaterial} attach="material" />
        </mesh>
        <pointLight ref={light} intensity={0} position={[0, 1, 0]} />
        <mesh ref={lightning} position={[0, 2, 0]} visible={false} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.8, 4]} />
          <primitive object={lightningMaterial} attach="material" />
        </mesh>
        <mesh ref={spark} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <planeGeometry args={[0.7, 0.7]} />
          <primitive object={sparkMaterial} attach="material" />
        </mesh>
      </group>
      <mesh ref={overlay} position={[0, 0, 1]} renderOrder={999}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial color={settings.overlay.startColor} transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
    </>
  );
}
