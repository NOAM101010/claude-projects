"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Bell, BellOff, Send } from "lucide-react";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushSetup() {
  const [status, setStatus] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") setStatus("granted");
    if (Notification.permission === "denied") setStatus("denied");
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/vapid-key");
      const { publicKey } = await keyRes.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setStatus("granted");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    await fetch("/api/push/test", { method: "POST" });
  }

  if (status === "unsupported") {
    return (
      <div className="text-sm text-[var(--muted)]">
        הדפדפן הזה לא תומך בהתראות push. פתח את האפליקציה בסמארטפון.
      </div>
    );
  }

  if (status === "granted") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-[var(--up)]">
          <Bell className="w-4 h-4" />
          <span>התראות מופעלות</span>
        </div>
        <Button variant="outline" size="sm" onClick={test}>
          <Send className="w-3.5 h-3.5" /> שלח בדיקה
        </Button>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--down)]">
        <BellOff className="w-4 h-4" />
        <span>התראות חסומות. אפשר בהגדרות הדפדפן.</span>
      </div>
    );
  }

  return (
    <Button variant="accent" onClick={enable} disabled={busy}>
      <Bell className="w-4 h-4" /> הפעל התראות
    </Button>
  );
}
