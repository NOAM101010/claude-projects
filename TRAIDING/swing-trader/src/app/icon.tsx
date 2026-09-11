import { ImageResponse } from "next/og";
import { CandleIcon } from "@/lib/icon-design";

export const contentType = "image/png";

const SIZES = [
  { id: "192", size: 192 },
  { id: "512", size: 512 },
];

export function generateImageMetadata() {
  return SIZES.map(({ id, size }) => ({
    id,
    size: { width: size, height: size },
    contentType,
  }));
}

export default function Icon({ id }: { id: string }) {
  const size = SIZES.find((s) => s.id === id)?.size ?? 192;
  return new ImageResponse(<CandleIcon size={size} />, { width: size, height: size });
}
