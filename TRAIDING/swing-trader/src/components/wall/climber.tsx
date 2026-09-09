"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { yFor, tickerHue, tickerPhase, type Range } from "./wall-math";

/* shared geometry — created once per module, reused by every climber */
const PITON_GEO = new THREE.BoxGeometry(0.18, 0.1, 0.14);
const ROPE_GEO = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
const PUFF_GEO = new THREE.IcosahedronGeometry(0.28, 0);
/* invisible click target that sits where the model's torso is */
const HIT_GEO = new THREE.CapsuleGeometry(0.22, 0.5, 3, 8);

const MODEL_URL = "/models/climber.glb";
const FIGURE_Z = 0.4;
const CLIMBER_HEIGHT = 1.05; // world units, feet-to-head after normalisation

export type ClimberData = {
  id: string;
  ticker: string;
  pct: number;
  stopPct: number | null;
  rMultiple: number | null;
  currentPrice: number | null;
  buyPrice: number;
  stopPrice: number | null;
  unrealizedPnl: number | null;
  earningsDate: string | null;
  buyDate: string;
  falling: boolean;
  crossed: { pct?: number; r?: number } | null;
};

type Props = ClimberData & {
  range: Range;
  x: number;
  focused: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
};

export default function Climber({
  id,
  ticker,
  pct,
  stopPct,
  range,
  x,
  falling,
  crossed,
  dimmed,
  focused,
  onSelect,
}: Props) {
  const figureRef = useRef<THREE.Group>(null);
  const leanRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const ropeRef = useRef<THREE.Mesh>(null);
  const puffRef = useRef<THREE.Mesh>(null);

  const targetYRef = useRef(yFor(pct, range));
  const fallStartRef = useRef<number | null>(null);
  const jumpStartRef = useRef<number | null>(null);
  const jumpRequestedRef = useRef(false);
  const dimRef = useRef(0);
  const phase = useMemo(() => tickerPhase(ticker), [ticker]);

  const pitonY = stopPct != null ? yFor(stopPct, range) : 0;

  const { scene } = useGLTF(MODEL_URL);

  const mats = useMemo(() => {
    const hue = tickerHue(ticker);
    const body = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue / 360, 0.55, 0.55),
      roughness: 0.55,
      flatShading: true,
      transparent: true,
      emissive: new THREE.Color("#10b981"),
      emissiveIntensity: 0.12,
    });
    const limb = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#2b2f38"),
      roughness: 0.8,
      flatShading: true,
      transparent: true,
    });
    const rope = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#10b981"),
      roughness: 0.9,
      transparent: true,
      opacity: 0.5,
    });
    const puff = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#e8b341"),
      transparent: true,
      opacity: 0,
      wireframe: true,
    });
    const hit = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return { body, limb, rope, puff, hit };
  }, [ticker]);

  // per-instance clone of the GLB, normalised to a fixed height and tinted
  const model = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = CLIMBER_HEIGHT / (size.y || 1);
    root.scale.setScalar(s);
    // feet just below the group origin, horizontally centred
    root.position.set(-center.x * s, -box.min.y * s - 0.28, -center.z * s);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        // own a private copy of the geometry so disposing this clone can't
        // free buffers still used by the cached GLB / sibling climbers
        if (m.geometry) m.geometry = m.geometry.clone();
        m.material = mats.body;
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = false;
      }
    });
    return root;
  }, [scene, mats]);

  // free this clone's owned geometry when deps change / on unmount
  // (materials point at the shared `mats` set, disposed separately below)
  useEffect(() => {
    return () => {
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry?.dispose?.();
      });
    };
  }, [model]);

  // dispose owned materials
  useEffect(() => {
    const m = mats;
    return () => {
      m.body.dispose();
      m.limb.dispose();
      m.rope.dispose();
      m.puff.dispose();
      m.hit.dispose();
    };
  }, [mats]);

  // keep P&L-driven colours in sync
  useEffect(() => {
    targetYRef.current = yFor(pct, range);
    const up = pct >= 0;
    mats.body.emissive.set(up ? "#10b981" : "#ef4444");
    mats.rope.color.set(up ? "#10b981" : "#ef4444");
  }, [pct, range, mats]);

  // fall trigger
  useEffect(() => {
    if (falling && fallStartRef.current == null) jumpRequestedRef.current = false;
    if (!falling) fallStartRef.current = null;
  }, [falling]);

  // milestone / R crossing → dramatic hop
  useEffect(() => {
    if (crossed) jumpRequestedRef.current = true;
  }, [crossed]);

  useFrame(({ clock }, delta) => {
    const g = figureRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const d = Math.min(delta, 0.05);

    // ── falling ────────────────────────────────────────────────
    if (falling) {
      if (fallStartRef.current == null) fallStartRef.current = t;
      const dt = t - fallStartRef.current;
      g.position.y -= d * (2.5 + dt * 9);
      g.rotation.z += d * 5;
      const k = Math.max(0, 1 - dt / 1.8);
      g.scale.setScalar(0.35 + 0.65 * k);
      mats.body.opacity = k;
      mats.limb.opacity = k;
      mats.rope.opacity = 0;
      if (ropeRef.current) ropeRef.current.visible = false;
      return;
    }

    // ── dramatic hop on milestone ──────────────────────────────
    if (jumpRequestedRef.current) {
      jumpStartRef.current = t;
      jumpRequestedRef.current = false;
    }
    let hop = 0;
    let armLift = 0;
    let puffP = 0;
    if (jumpStartRef.current != null) {
      const dt = t - jumpStartRef.current;
      if (dt > 0.75) {
        jumpStartRef.current = null;
      } else {
        const p = dt / 0.75;
        hop = Math.sin(p * Math.PI) * 0.42;
        armLift = Math.sin(p * Math.PI) * 1.3;
        puffP = p;
      }
    }

    // ── vertical glide toward target ───────────────────────────
    const goal = targetYRef.current + hop;
    g.position.y = THREE.MathUtils.damp(g.position.y, goal, 2.5, d);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, 0, 6, d);

    // ── idle sway ─────────────────────────────────────────────
    if (bodyRef.current) {
      bodyRef.current.rotation.z = Math.sin(t * 1.5 + phase) * 0.035;
      bodyRef.current.position.y = Math.sin(t * 1.5 + phase * 1.7) * 0.02;
    }
    if (leanRef.current) {
      // small backward lean while celebrating a milestone
      leanRef.current.rotation.x = THREE.MathUtils.damp(
        leanRef.current.rotation.x,
        -armLift * 0.12,
        8,
        d
      );
    }

    // ── dim / focus fade ──────────────────────────────────────
    const dimGoal = dimmed ? 1 : 0;
    dimRef.current = THREE.MathUtils.damp(dimRef.current, dimGoal, 6, d);
    const op = 1 - dimRef.current * 0.78;
    const sc = 1 - dimRef.current * 0.12;
    mats.body.opacity = op;
    mats.limb.opacity = op;
    mats.rope.opacity = (1 - dimRef.current * 0.7) * (focused ? 0.7 : 0.5);
    g.scale.setScalar(sc);
    mats.body.emissiveIntensity = focused ? 0.28 : 0.12;

    // ── rope: spans from piton (fixed) to the figure (moving) ──
    if (ropeRef.current && stopPct != null) {
      const figY = g.position.y;
      const len = Math.abs(figY - pitonY);
      ropeRef.current.visible = true;
      ropeRef.current.position.y = (figY + pitonY) / 2;
      ropeRef.current.scale.y = Math.max(0.001, len);
    }

    // ── puff ──────────────────────────────────────────────────
    if (puffRef.current) {
      if (puffP > 0) {
        puffRef.current.visible = true;
        puffRef.current.scale.setScalar(0.4 + puffP * 1.6);
        mats.puff.opacity = (1 - puffP) * 0.7;
      } else if (puffRef.current.visible) {
        puffRef.current.visible = false;
        mats.puff.opacity = 0;
      }
    }
  });

  const pctLabel = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  const pctColor = pct >= 0 ? "#34d399" : "#f87171";

  return (
    <group position={[x, 0, 0]}>
      {/* fixed anchor + rope (outside the animated figure group) */}
      {stopPct != null && (
        <>
          <mesh geometry={PITON_GEO} position={[0, pitonY, FIGURE_Z]} material={mats.limb} />
          <mesh
            ref={ropeRef}
            geometry={ROPE_GEO}
            material={mats.rope}
            position={[0, 0, FIGURE_Z + 0.02]}
          />
        </>
      )}

      {/* the climber */}
      <group ref={figureRef} position={[0, targetYRef.current, FIGURE_Z]}>
        <mesh
          ref={puffRef}
          geometry={PUFF_GEO}
          material={mats.puff}
          position={[0, 0.35, 0]}
          visible={false}
        />

        <group ref={bodyRef}>
          <group
            ref={leanRef}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
          >
            <primitive object={model} />
            {/* generous transparent hit area so clicking is easy */}
            <mesh geometry={HIT_GEO} material={mats.hit} position={[0, 0.35, 0]} />
          </group>
        </group>

        {/* floating label */}
        <Billboard position={[0, 1.35, 0]}>
          <Text fontSize={0.26} color="#f4f5f7" anchorX="center" anchorY="bottom" outlineWidth={0.012} outlineColor="#05060a">
            {ticker}
          </Text>
          <Text position={[0, -0.06, 0]} fontSize={0.2} color={pctColor} anchorX="center" anchorY="top">
            {pctLabel}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}

if (typeof window !== "undefined") {
  useGLTF.preload(MODEL_URL);
}
