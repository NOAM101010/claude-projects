import webpush from "web-push";
import { prisma } from "./prisma";

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT ?? "mailto:noam701010@gmail.com";
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(contact, publicKey, privateKey);
  configured = true;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function sendPushToAll(payload: {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}) {
  configure();
  if (!process.env.VAPID_PUBLIC_KEY) {
    console.warn("[push] VAPID keys not configured, skipping push");
    return { sent: 0, failed: 0 };
  }

  const subs = await prisma.pushSubscription.findMany();
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload)
        );
        sent++;
      } catch (e: any) {
        failed++;
        // Cleanup expired subscriptions
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await prisma.pushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => {});
        }
      }
    })
  );

  return { sent, failed };
}
