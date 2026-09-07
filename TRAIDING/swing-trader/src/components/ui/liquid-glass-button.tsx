"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────
   Liquid / Metal buttons.
   LiquidButton relies on a heavy SVG backdrop-filter (GlassFilter)
   — use it once per page at most.
   ────────────────────────────────────────────────────────────── */

const liquidbuttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold tracking-wide text-[var(--warn-2)] transition-transform duration-200 hover:-translate-y-px active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none outline-none relative isolate",
  {
    variants: {
      size: {
        default: "h-11 px-6",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
      },
    },
    defaultVariants: { size: "default" },
  }
);

type LiquidButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof liquidbuttonVariants> & { asChild?: boolean };

function LiquidButton({
  className,
  size,
  asChild = false,
  children,
  ...props
}: LiquidButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(liquidbuttonVariants({ size }), className)} {...props}>
      <div
        className="absolute inset-0 -z-10 rounded-full"
        style={{
          backdropFilter: 'url("#liquid-glass-filter")',
          WebkitBackdropFilter: 'url("#liquid-glass-filter")',
        }}
      />
      <div
        className="absolute inset-0 -z-10 rounded-full"
        style={{
          background:
            "linear-gradient(180deg, rgba(232,179,65,0.18) 0%, rgba(232,179,65,0.05) 45%, rgba(0,0,0,0.28) 100%)",
        }}
      />
      <div className="absolute inset-0 -z-10 rounded-full border border-[rgba(232,179,65,0.34)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_20px_-4px_rgba(232,179,65,0.45),0_10px_28px_-8px_rgba(0,0,0,0.65)]" />
      <span className="relative flex items-center gap-2">{children}</span>
      <GlassFilter />
    </Comp>
  );
}

const metalButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-semibold transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none outline-none border border-[var(--metal-edge)] text-[var(--fg)]",
  {
    variants: {
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-base",
      },
      tint: {
        steel: "",
        graphite: "",
        amber: "text-[var(--warn-2)]",
        danger: "text-[var(--down-2)]",
      },
    },
    defaultVariants: { size: "default", tint: "steel" },
  }
);

/* 4 machined finishes */
const METAL_BG: Record<string, string> = {
  steel: "linear-gradient(180deg, #20242b 0%, #15181d 52%, #0c0e11 100%)",
  graphite: "linear-gradient(180deg, #17191d 0%, #101216 52%, #0a0b0d 100%)",
  amber:
    "linear-gradient(180deg, rgba(232,179,65,0.16) 0%, rgba(232,179,65,0.06) 52%, rgba(232,179,65,0.03) 100%)",
  danger:
    "linear-gradient(180deg, rgba(239,68,68,0.16) 0%, rgba(239,68,68,0.06) 52%, rgba(239,68,68,0.03) 100%)",
};

type MetalButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof metalButtonVariants> & { asChild?: boolean };

function MetalButton({
  className,
  size,
  tint = "steel",
  asChild = false,
  style,
  ...props
}: MetalButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(metalButtonVariants({ size, tint }), className)}
      style={{
        background: METAL_BG[tint ?? "steel"],
        boxShadow:
          "inset 0 1px 0 var(--metal-hi), inset 0 -10px 16px -12px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.45)",
        ...style,
      }}
      {...props}
    />
  );
}

function GlassFilter() {
  return (
    <svg className="hidden">
      <defs>
        <filter
          id="liquid-glass-filter"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="5"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurred" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurred"
            scale="70"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

export { LiquidButton, MetalButton, liquidbuttonVariants };
