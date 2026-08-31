/**
 * CITY EMPIRE — <Interactable> wrapper (MASTER §16).
 *
 * Drop this around any 3D object to make it interactable. It registers
 * with the interaction store on mount and shows a subtle floating beacon
 * when the object is available, so the player can spot opportunities in
 * the world (e.g. a "FOR SALE" business — MASTER §31).
 *
 * The object itself contains NO interaction logic — it just declares
 * verb/label/onInteract here.
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useInteractionStore, type Interactable as IInteractable } from './useInteractionStore';

interface Props {
  id: string;
  verb: string;
  label: string;
  position: [number, number, number];
  onInteract: () => void;
  isAvailable?: () => boolean;
  range?: number;
  /** Height above the object at which the beacon floats. */
  beaconHeight?: number;
  /** Beacon colour (defaults to a warm "for sale" gold). */
  beaconColor?: string;
  children?: ReactNode;
}

export function Interactable({
  id,
  verb,
  label,
  position,
  onInteract,
  isAvailable,
  range,
  beaconHeight = 3,
  beaconColor = '#f5c451',
  children,
}: Props) {
  const register = useInteractionStore((s) => s.register);
  const focused = useInteractionStore((s) => s.focused);
  const beaconRef = useRef<Mesh>(null);

  const config = useMemo<IInteractable>(
    () => ({
      id,
      verb,
      label,
      range,
      isAvailable,
      getPosition: () => position,
      onInteract,
    }),
    // Re-register if identity-defining props change.
    [id, verb, label, range, position, isAvailable, onInteract],
  );

  useEffect(() => register(config), [register, config]);

  // Gentle bob + spin so the beacon reads as "interactive".
  useFrame((state) => {
    const b = beaconRef.current;
    if (!b) return;
    const t = state.clock.elapsedTime;
    b.position.y = beaconHeight + Math.sin(t * 2) * 0.12;
    b.rotation.y = t * 1.5;
  });

  const available = isAvailable ? isAvailable() : true;
  const isFocused = focused?.id === id;

  return (
    <group position={position}>
      {children}
      {available && (
        <mesh ref={beaconRef} position={[0, beaconHeight, 0]}>
          <octahedronGeometry args={[isFocused ? 0.28 : 0.2, 0]} />
          <meshStandardMaterial
            color={beaconColor}
            emissive={beaconColor}
            emissiveIntensity={isFocused ? 1.4 : 0.7}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}
