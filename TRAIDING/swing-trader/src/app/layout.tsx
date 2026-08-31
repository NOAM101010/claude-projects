import type { Metadata, Viewport } from "next";
import { Heebo, Inter, JetBrains_Mono } from "next/font/google";
import PillNav from "@/components/pill-nav";
import { Component as SpotlightCursor } from "@/components/ui/spotlight-cursor";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Swing Terminal",
  description: "צ׳אט מסחר · סורק · ניתוח טריידים",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Swing Terminal",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full text-[var(--fg)]">
        <div className="cinematic-bg" aria-hidden />
        <div className="grain" aria-hidden />
        <SpotlightCursor config={{ crosshair: false }} />
        <PillNav />
        <main className="pt-24 md:pt-28 pb-20 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
