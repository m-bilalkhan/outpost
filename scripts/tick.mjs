// Fire one tick by hand, signed exactly like the Cloudflare Worker does.
//
//   node --env-file=.env.local scripts/tick.mjs
//   node --env-file=.env.local scripts/tick.mjs https://outpost.vercel.app
//
import { createHmac } from "node:crypto";

const base = process.argv[2] ?? "http://localhost:3000";
const secret = process.env.CRON_SHARED_SECRET;
if (!secret) {
  console.error("CRON_SHARED_SECRET is not set. Try: node --env-file=.env.local scripts/tick.mjs");
  process.exit(1);
}

const ts = Math.floor(Date.now() / 1000).toString();
const sig = createHmac("sha256", secret).update(ts).digest("hex");

const res = await fetch(`${base}/api/cron/tick`, {
  method: "POST",
  headers: { "x-outpost-ts": ts, "x-outpost-sig": sig },
});
console.log(res.status, await res.text());
