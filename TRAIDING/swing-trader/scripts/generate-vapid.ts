import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("");
console.log("VAPID keys generated. Add these to your .env file:");
console.log("");
console.log(`VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
console.log(`VAPID_CONTACT="mailto:noam701010@gmail.com"`);
console.log("");
