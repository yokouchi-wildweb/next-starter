"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { cn } from "@/lib/cn";

const TRACK_SEGMENTS = 600;

function useRollercoasterCurve() {
  return useMemo(() => {
    const points = [
      new THREE.Vector3(0, 1.2, 0),
      new THREE.Vector3(4.5, 2.8, -12),
      new THREE.Vector3(-3.5, -0.6, -22),
      new THREE.Vector3(6, 3.5, -35),
      new THREE.Vector3(-5.5, 1.8, -48),
      new THREE.Vector3(3, -1.2, -62),
      new THREE.Vector3(-1.5, 0.6, -78),
    ];

    const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.6);
    return curve;
  }, []);
}

type CameraRigProps = {
  curve: THREE.CatmullRomCurve3;
};

function CameraRig({ curve }: CameraRigProps) {
  const progress = useRef(0);
  const roll = useRef(0);
  const smoothingTarget = useRef(new THREE.Vector3());

  useFrame(({ camera }, delta) => {
    progress.current = (progress.current + delta * 0.045) % 1;
    const t = progress.current;

    const positionOnTrack = curve.getPointAt(t);
    smoothingTarget.current.lerp(positionOnTrack, 0.1);

    camera.position.copy(smoothingTarget.current);

    const lookAhead = curve.getPointAt((t + 0.01) % 1);
    camera.lookAt(lookAhead);

    const dynamicRoll = Math.sin(t * Math.PI * 8) * 0.65 + Math.cos(progress.current * 14) * 0.25;
    roll.current = THREE.MathUtils.lerp(roll.current, dynamicRoll, 0.08);
    camera.rotation.z = roll.current;
  });

  return null;
}

type RollercoasterTrackProps = {
  curve: THREE.CatmullRomCurve3;
};

function RollercoasterTrack({ curve }: RollercoasterTrackProps) {
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, TRACK_SEGMENTS, 0.35, 12, true), [curve]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#f5f5f5"
        emissive="#e3e5e8"
        emissiveIntensity={0.65}
        roughness={0.2}
        metalness={0.55}
        opacity={0.95}
        transparent
      />
    </mesh>
  );
}

type RailLightsProps = {
  curve: THREE.CatmullRomCurve3;
};

function RailLights({ curve }: RailLightsProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 180;

  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i++) {
      const t = (i / count) % 1;
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const lateral = new THREE.Vector3().crossVectors(tangent, up);
      if (lateral.lengthSq() < 1e-6) {
        lateral.set(1, 0, 0);
      } else {
        lateral.normalize();
      }
      const side = i % 2 === 0 ? 1 : -1;
      const position = point.clone().add(lateral.multiplyScalar(0.8 * side));

      dummy.position.copy(position);
      dummy.scale.setScalar(0.38);
      dummy.lookAt(point.clone().add(tangent.multiplyScalar(1.6)));
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);

      const glow = new THREE.Color("#f8fafc");
      const accent = new THREE.Color("#e6e9f0");
      const color = glow.clone().lerp(accent, i / count);
      ref.current.setColorAt(i, color);
    }

    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) {
      ref.current.instanceColor.needsUpdate = true;
    }
  }, [curve, count]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[0.12, 0.12, 1.6, 12]} />
      <meshStandardMaterial
        color="#f8fafc"
        emissive="#e9edf3"
        emissiveIntensity={1.2}
        roughness={0.25}
        metalness={0.4}
      />
    </instancedMesh>
  );
}

function StarTunnel() {
  const ref = useRef<THREE.Points>(null);
  const count = 900;
  const depth = 120;
  const radius = 24;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = radius * Math.pow(Math.random(), 0.45);
      const x = Math.cos(angle) * distance;
      const y = (Math.random() - 0.5) * radius * 0.8;
      const z = -Math.random() * depth;
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    return arr;
  }, [count, depth, radius]);

  const speeds = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = 24 + Math.random() * 36;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    const points = ref.current;
    if (!points) return;
    const positionAttr = points.geometry.attributes.position;
    const array = positionAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      array[i * 3 + 2] += speeds[i] * delta;
      if (array[i * 3 + 2] > 6) {
        array[i * 3 + 2] = -depth;
        const angle = Math.random() * Math.PI * 2;
        const distance = radius * Math.pow(Math.random(), 0.45);
        array[i * 3] = Math.cos(angle) * distance;
        array[i * 3 + 1] = (Math.random() - 0.5) * radius * 0.8;
      }
    }

    points.rotation.z += delta * 0.1;
    positionAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#f6f7f9"
        size={0.32}
        transparent
        opacity={0.78}
        depthWrite={false}
      />
    </points>
  );
}

function VelocityTrails() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 48;

  const basePositions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = -Math.random() * 90;
    }
    return arr;
  }, [count]);

  const speeds = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = 32 + Math.random() * 24;
    }
    return arr;
  }, [count]);

  const lengths = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = 1.4 + Math.random() * 0.6;
    }
    return arr;
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!ref.current) return;

    for (let i = 0; i < count; i++) {
      const index = i * 3;
      basePositions[index + 2] += speeds[i] * delta;
      if (basePositions[index + 2] > 5) {
        basePositions[index] = (Math.random() - 0.5) * 20;
        basePositions[index + 1] = (Math.random() - 0.5) * 12;
        basePositions[index + 2] = -110;
      }

      dummy.position.set(
        basePositions[index],
        basePositions[index + 1],
        basePositions[index + 2]
      );
      const length = lengths[i];
      dummy.scale.set(0.2, 0.2, length);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }

    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.32, 0.32, 4]} />
      <meshStandardMaterial
        color="#f2f4f8"
        emissive="#dde1e7"
        emissiveIntensity={1.35}
        roughness={0.18}
        metalness={0.35}
        opacity={0.82}
        transparent
      />
    </instancedMesh>
  );
}

function HorizonGlow() {
  return (
    <mesh position={[0, -6, -80]}>
      <sphereGeometry args={[48, 32, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.2} />
    </mesh>
  );
}

function CosmicCoasterSceneContent() {
  const curve = useRollercoasterCurve();
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.near = 0.1;
    camera.far = 500;
    camera.updateProjectionMatrix();
  }, [camera]);

  return (
    <group>
      <CameraRig curve={curve} />
      <StarTunnel />
      <VelocityTrails />
      <HorizonGlow />
      <RollercoasterTrack curve={curve} />
      <RailLights curve={curve} />
    </group>
  );
}

type CosmicCoasterSceneProps = {
  className?: string;
};

export function CosmicCoasterScene({ className }: CosmicCoasterSceneProps) {
  return (
    <div className={cn("pointer-events-none fixed inset-0 z-0", className)}>
      <Canvas camera={{ position: [0, 1.2, 6], fov: 58 }} gl={{ alpha: true, antialias: true }}>
        <color attach="background" args={["#f7f8fb"]} />
        <fog attach="fog" args={["#eff2f7", 28, 220]} />
        <ambientLight intensity={0.95} color="#f8f9fb" />
        <directionalLight position={[12, 24, 18]} intensity={0.9} color="#f0f2f6" />
        <directionalLight position={[-16, -18, -22]} intensity={0.35} color="#d6dae2" />
        <Suspense fallback={null}>
          <CosmicCoasterSceneContent />
        </Suspense>
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/40 to-white/80" />
    </div>
  );
}

export default CosmicCoasterScene;
