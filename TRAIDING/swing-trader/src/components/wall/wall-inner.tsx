"use client";

import { useSearchParams } from "next/navigation";
import { useLiveData } from "@/components/dashboard/use-live-data";
import ClimbWall, { type PositionsData } from "@/components/wall/climb-wall";

export default function WallInner() {
  const params = useSearchParams();
  const focus = params.get("focus");
  const { data, loading } = useLiveData<PositionsData>("/api/positions", { intervalMs: 20_000 });

  return (
    <ClimbWall positions={data?.positions ?? []} focusId={focus} loading={loading} />
  );
}
