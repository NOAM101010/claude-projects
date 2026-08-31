"use client";
import { useRef, useEffect, HTMLAttributes } from "react";

interface TradingSpotlightConfig {
  /** Spotlight glow radius in px */
  radius?: number;
  /** Spotlight glow opacity (0-1) */
  brightness?: number;
  /** Spotlight color, hex (defaults to the app's --up green) */
  color?: string;
  /** Draw a TradingView-style dashed crosshair through the cursor */
  crosshair?: boolean;
  /** Crosshair line color, hex */
  crosshairColor?: string;
  /** Fire an expanding "trade ping" ring on click (green = buy / left click, red = sell / right click) */
  pulseOnClick?: boolean;
  /** Disable everything on touch/coarse-pointer devices (default true) */
  disableOnTouch?: boolean;
}

type Pulse = { x: number; y: number; r: number; alpha: number; color: string };

function hexToRgb(hex: string) {
  const bigint = parseInt(hex.replace("#", ""), 16);
  return `${(bigint >> 16) & 255},${(bigint >> 8) & 255},${bigint & 255}`;
}

const useTradingSpotlight = (config: Required<TradingSpotlightConfig>) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (config.disableOnTouch && window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let mouseX = -1000;
    let mouseY = -1000;
    let active = false;
    const pulses: Pulse[] = [];

    const spotRgb = hexToRgb(config.color);
    const crossRgb = hexToRgb(config.crosshairColor);

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      active = true;
    };

    const handleMouseLeave = () => {
      active = false;
      mouseX = -1000;
      mouseY = -1000;
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!config.pulseOnClick) return;
      const isSell = event.button === 2;
      pulses.push({
        x: event.clientX,
        y: event.clientY,
        r: 4,
        alpha: 0.55,
        color: isSell ? "239,68,68" : "16,185,129",
      });
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (config.pulseOnClick) event.preventDefault();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (active) {
        // Spotlight glow
        const gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, config.radius);
        gradient.addColorStop(0, `rgba(${spotRgb},${config.brightness})`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // TradingView-style crosshair
        if (config.crosshair) {
          ctx.save();
          ctx.strokeStyle = `rgba(${crossRgb},0.35)`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, mouseY);
          ctx.lineTo(canvas.width, mouseY);
          ctx.moveTo(mouseX, 0);
          ctx.lineTo(mouseX, canvas.height);
          ctx.stroke();
          ctx.restore();

          // small crosshair ring, like a chart price marker
          ctx.beginPath();
          ctx.arc(mouseX, mouseY, 4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${crossRgb},0.9)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // "Trade ping" ripples on click
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${p.color},${p.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        p.r += 2.2;
        p.alpha *= 0.955;
        if (p.alpha < 0.02) pulses.splice(i, 1);
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("contextmenu", handleContextMenu);
    animationFrameId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      cancelAnimationFrame(animationFrameId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.radius,
    config.brightness,
    config.color,
    config.crosshair,
    config.crosshairColor,
    config.pulseOnClick,
    config.disableOnTouch,
  ]);

  return canvasRef;
};

interface SpotlightCursorProps extends HTMLAttributes<HTMLCanvasElement> {
  config?: TradingSpotlightConfig;
}

export const Component = ({ config = {}, className, ...rest }: SpotlightCursorProps) => {
  const spotlightConfig: Required<TradingSpotlightConfig> = {
    radius: 220,
    brightness: 0.12,
    color: "#10b981", // matches --up
    crosshair: true,
    crosshairColor: "#10b981",
    pulseOnClick: true,
    disableOnTouch: true,
    ...config,
  };

  const canvasRef = useTradingSpotlight(spotlightConfig);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`fixed top-0 left-0 pointer-events-none z-[9999] w-full h-full ${className ?? ""}`}
      {...rest}
    />
  );
};
