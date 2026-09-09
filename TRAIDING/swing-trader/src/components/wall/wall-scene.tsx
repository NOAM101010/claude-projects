"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Cliff from "./cliff";
import Climber, { type ClimberData } from "./climber";
import Mountains, { HERO_MOUNTAIN_URL, BG_MOUNTAIN_URL } from "./mountains";
import { MAX_CLIMBERS, WALL_H, xFor, yFor, type Range } from "./wall-math";

type Props = {
  climbers: ClimberData[];
  focusId: string | null;
  range: Range;
  hidden: boolean;
  onSelect: (id: string) => void;
};

const DEFAULT_Y = WALL_H * 0.44;

function rLinesFor(c: ClimberData | undefined, range: Range) {
  if (!c || c.stopPrice == null || c.buyPrice === 0) return [];
  const perR = ((c.buyPrice - c.stopPrice) / c.buyPrice) * 100;
  if (!(perR > 0)) return [];
  return [1, 2, 3]
    .map((n) => ({ n, pct: perR * n }))
    .filter((r) => r.pct <= range.max);
}

/** eases the camera toward the focused climber, then hands control back to the user */
function CameraRig({
  focusTarget,
}: {
  focusTarget: { x: number; y: number } | null;
}) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;
  const prevKey = useRef<string>("");
  const activeUntil = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!controls) return;
    const d = Math.min(delta, 0.05);
    const key = focusTarget ? `${focusTarget.x.toFixed(2)}:${focusTarget.y.toFixed(2)}` : "none";
    if (key !== prevKey.current) {
      prevKey.current = key;
      activeUntil.current = clock.elapsedTime + 1.6;
    }

    const goalTargetX = focusTarget ? focusTarget.x : 0;
    const goalTargetY = focusTarget ? focusTarget.y : DEFAULT_Y;

    controls.target.x = THREE.MathUtils.damp(controls.target.x, goalTargetX, 3, d);
    controls.target.y = THREE.MathUtils.damp(controls.target.y, goalTargetY, 3, d);

    if (clock.elapsedTime < activeUntil.current) {
      const gx = focusTarget ? focusTarget.x : 0;
      const gy = focusTarget ? focusTarget.y + 1 : DEFAULT_Y;
      const gz = focusTarget ? 9 : 14;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, gx, 3, d);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, gy, 3, d);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, gz, 3, d);
    }
    controls.update();
  });

  return null;
}

/** kick R3F back into rendering when the tab becomes visible again */
function ResumeOnShow({ hidden }: { hidden: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    if (hidden) return;
    setFrameloop("always");
    invalidate();
  }, [hidden, invalidate, setFrameloop]);
  return null;
}

export default function WallScene({ climbers, focusId, range, hidden, onSelect }: Props) {
  const shown = useMemo(() => climbers.slice(0, MAX_CLIMBERS), [climbers]);

  // free the GLB cache when the wall unmounts
  useEffect(() => {
    return () => {
      useGLTF.clear(["/models/climber.glb", HERO_MOUNTAIN_URL, BG_MOUNTAIN_URL]);
    };
  }, []);

  const focusTarget = useMemo(() => {
    if (!focusId) return null;
    const idx = shown.findIndex((c) => c.id === focusId);
    if (idx === -1) return null;
    return { x: xFor(idx, shown.length), y: yFor(shown[idx].pct, range) };
  }, [focusId, shown, range]);

  const rLines = useMemo(() => {
    const focused = focusId ? shown.find((c) => c.id === focusId) : shown[0];
    return rLinesFor(focused, range);
  }, [focusId, shown, range]);

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      frameloop={hidden ? "never" : "always"}
      camera={{ position: [0, DEFAULT_Y, 14], fov: 42 }}
    >
      <color attach="background" args={["#0a0e15"]} />
      <fog attach="fog" args={["#0a0e15", 13, 36]} />

      <hemisphereLight args={["#a9c7e8", "#3a2f26", 1.15]} />
      <directionalLight position={[4, 12, 8]} intensity={1.1} color="#fff4e0" />

      <Cliff range={range} rLines={rLines} />

      <Suspense fallback={null}>
        <Mountains />
        {shown.map((c, i) => (
          <Climber
            key={c.id}
            {...c}
            range={range}
            x={xFor(i, shown.length)}
            focused={focusId === c.id || focusId == null}
            dimmed={focusId != null && focusId !== c.id}
            onSelect={onSelect}
          />
        ))}
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={22}
        minPolarAngle={Math.PI * 0.16}
        maxPolarAngle={Math.PI * 0.84}
        target={[0, DEFAULT_Y, 0]}
      />
      <CameraRig focusTarget={focusTarget} />
      <ResumeOnShow hidden={hidden} />
    </Canvas>
  );
}
