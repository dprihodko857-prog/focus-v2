import { chmodSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import webPush from "web-push";

const targetPath = resolve(process.argv[2] || "data/focus-v2.env");
const subject = process.env.FOCUS_VAPID_SUBJECT || "mailto:focus@dmnao83.ru";

if (existsSync(targetPath) && statSync(targetPath).size > 0) {
  process.exit(0);
}

const keys = webPush.generateVAPIDKeys();
const envBody = [
  `FOCUS_VAPID_PUBLIC_KEY=${keys.publicKey}`,
  `FOCUS_VAPID_PRIVATE_KEY=${keys.privateKey}`,
  `FOCUS_VAPID_SUBJECT=${subject}`,
  "",
].join("\n");

mkdirSync(dirname(targetPath), { recursive: true });
writeFileSync(targetPath, envBody, { mode: 0o600 });
chmodSync(targetPath, 0o600);
