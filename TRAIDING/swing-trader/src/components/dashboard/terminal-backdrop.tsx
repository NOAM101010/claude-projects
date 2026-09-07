/**
 * Fixed depth plate behind the dashboard: a still engineering grid and a
 * vignette. No animation, no parallax, no scanline — the control room holds
 * its pose so live numbers are the only thing that moves.
 */
export default function TerminalBackdrop() {
  return (
    <div className="dash-backdrop" aria-hidden>
      <div className="dash-layer dash-layer--grid" />
      <div className="dash-vignette" />
    </div>
  );
}
