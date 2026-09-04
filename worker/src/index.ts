export interface Env {
  OUTPOST_URL: string;
  CRON_SHARED_SECRET: string;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return toHex(sig);
}

async function pokeOutpost(env: Env): Promise<Response> {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await sign(env.CRON_SHARED_SECRET, ts);

  const res = await fetch(`${env.OUTPOST_URL}/api/cron/tick`, {
    method: "POST",
    headers: {
      "x-outpost-ts": ts,
      "x-outpost-sig": sig,
      "user-agent": "outpost-cron/1",
    },
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`tick failed ${res.status}: ${body.slice(0, 500)}`);
  } else {
    console.log(`tick ok: ${body.slice(0, 500)}`);
  }
  return res;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(pokeOutpost(env));
  },

  // Lets you fire a tick by hand from `wrangler dev`, or curl the worker URL
  // if you deploy it with a route. Same signature, no bypass.
  async fetch(_req: Request, env: Env): Promise<Response> {
    const res = await pokeOutpost(env);
    return new Response(`upstream ${res.status}\n`, { status: res.ok ? 200 : 502 });
  },
};
