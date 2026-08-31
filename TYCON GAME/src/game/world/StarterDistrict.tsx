/**
 * CITY EMPIRE — Starter slice of the EUROPEAN DISTRICT (MASTER §11–12).
 *
 * A small but dense, believable street: a central road with sidewalks,
 * buildings on both sides, trees and street lights, plus two demo
 * interactables that exercise the interaction framework — a business
 * marked "for sale" and a pickup that grants cash.
 *
 * This is deliberately compact (MASTER §12: "do NOT build a giant empty
 * map") and is the ground the player, camera and interaction systems are
 * validated against before later phases flesh out the full district.
 */

import { useMemo } from 'react';
import { Building, Bench, StreetLight, Tree } from './props';
import { Interactable } from '../interaction/Interactable';
import { usePlayerStore } from '../state/usePlayerStore';
import { useInteractionStore } from '../interaction/useInteractionStore';
import { notify } from '../state/useNotifications';
import { makeAsphaltTexture, makeGrassTexture, makeSidewalkTexture } from './textures';

const ROAD_HALF = 4; // road is 8m wide, centered on X=0, running along Z

/** Clone a cached base ground texture and give this instance its own tiling. */
function tiled(base: ReturnType<typeof makeGrassTexture>, rx: number, ry: number) {
  const t = base.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

export function StarterDistrict() {
  const addCash = usePlayerStore((s) => s.addCash);

  const grassTex = useMemo(() => tiled(makeGrassTexture(), 50, 50), []);
  const roadTex = useMemo(() => tiled(makeAsphaltTexture(), 4, 60), []);
  const sidewalkTex = useMemo(() => tiled(makeSidewalkTexture(), 1.5, 60), []);

  return (
    <group>
      {/* Grass ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial map={grassTex} roughness={1} />
      </mesh>

      {/* Road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROAD_HALF * 2, 120]} />
        <meshStandardMaterial map={roadTex} roughness={0.95} />
      </mesh>
      {/* Dashed centre line */}
      {Array.from({ length: 24 }).map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, -55 + i * 4.8]}
          receiveShadow
        >
          <planeGeometry args={[0.2, 1.8]} />
          <meshStandardMaterial color="#c9b467" roughness={0.8} />
        </mesh>
      ))}

      {/* Sidewalks (both sides) */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[side * (ROAD_HALF + 1.5), 0.02, 0]}
          receiveShadow
        >
          <planeGeometry args={[3, 120]} />
          <meshStandardMaterial map={sidewalkTex} roughness={1} />
        </mesh>
      ))}

      {/* Buildings — west side (negative X) */}
      <Building position={[-11, 0, -18]} size={[8, 12, 9]} wall="#8a5a44" litRatio={0.15} />
      <Building position={[-11, 0, -6]} size={[8, 9, 9]} wall="#9c7f52" litRatio={0.1} />
      <Building position={[-11, 0, 8]} size={[8, 14, 9]} wall="#6f7b8c" litRatio={0.2} />
      <Building position={[-11, 0, 20]} size={[8, 10, 9]} wall="#a86b52" litRatio={0.12} />

      {/* Buildings — east side (positive X) */}
      <Building position={[11, 0, -20]} size={[8, 11, 9]} wall="#7d8a6b" rotation={Math.PI} litRatio={0.14} />
      <Building position={[11, 0, -4]} size={[8, 16, 9]} wall="#6a6f7a" rotation={Math.PI} litRatio={0.22} />
      <Building position={[11, 0, 12]} size={[8, 9, 9]} wall="#b08a5c" rotation={Math.PI} litRatio={0.1} />

      {/* Street furniture */}
      {[-24, -12, 0, 12, 24].map((z) => (
        <StreetLight key={`sl-l-${z}`} position={[-(ROAD_HALF + 0.6), 0, z]} />
      ))}
      {[-18, -6, 6, 18].map((z) => (
        <StreetLight key={`sl-r-${z}`} position={[ROAD_HALF + 0.6, 0, z]} />
      ))}
      {[-20, -8, 4, 16].map((z) => (
        <Tree key={`tree-l-${z}`} position={[-(ROAD_HALF + 2.4), 0, z]} />
      ))}
      {[-14, -2, 10, 22].map((z) => (
        <Tree key={`tree-r-${z}`} position={[ROAD_HALF + 2.4, 0, z]} />
      ))}
      <Bench position={[-(ROAD_HALF + 1.6), 0, 2]} rotation={Math.PI / 2} />
      <Bench position={[ROAD_HALF + 1.6, 0, -2]} rotation={-Math.PI / 2} />

      {/* --- Demo interactables (validate the interaction framework) --- */}

      {/* A business marked "for sale" — full purchase flow arrives in the
          Business phase; for now it demonstrates focus + prompt + feedback. */}
      <Interactable
        id="biz_cafe_demo"
        verb="Inspect"
        label="Small Cafe"
        position={[-(ROAD_HALF + 2.6), 0, 14]}
        beaconColor="#f5c451"
        onInteract={() =>
          notify.info('Small Cafe — For Sale · €50,000. Purchasing arrives in the Business phase.')
        }
      >
        {/* A little kiosk stand-in for the cafe entrance. */}
        <group>
          <mesh position={[0, 1, 0]} castShadow>
            <boxGeometry args={[2.2, 2, 2]} />
            <meshStandardMaterial color="#caa06a" roughness={0.85} />
          </mesh>
          <mesh position={[0, 2.15, 0]} castShadow>
            <boxGeometry args={[2.6, 0.3, 2.4]} />
            <meshStandardMaterial color="#7a3b34" roughness={0.8} />
          </mesh>
        </group>
      </Interactable>

      {/* A cash pickup — demonstrates interaction hooking into the economy. */}
      <CashPickup onCollect={() => addCash(100)} />
    </group>
  );
}

/** A one-shot pickup: grants cash, then removes its own beacon (availability). */
function CashPickup({ onCollect }: { onCollect: () => void }) {
  const setFlag = useCollectedFlag();
  return (
    <Interactable
      id="pickup_cash_demo"
      verb="Pick up"
      label="Cash Bundle"
      position={[ROAD_HALF + 2.4, 0, 4]}
      beaconColor="#7ee081"
      isAvailable={() => !setFlag.collected}
      onInteract={() => {
        if (setFlag.collected) return;
        setFlag.set(true);
        onCollect();
        notify.success('Found €100!');
        // Clear focus so the prompt disappears immediately.
        useInteractionStore.setState({ focused: null });
      }}
    >
      {!setFlag.collected && (
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[0.5, 0.35, 0.25]} />
          <meshStandardMaterial color="#2e7d4f" roughness={0.7} />
        </mesh>
      )}
    </Interactable>
  );
}

/** Minimal local "collected" latch kept outside React state for simplicity. */
const collectedState = { collected: false };
function useCollectedFlag() {
  return {
    get collected() {
      return collectedState.collected;
    },
    set(v: boolean) {
      collectedState.collected = v;
    },
  };
}
