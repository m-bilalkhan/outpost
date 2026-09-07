import { NextResponse } from "next/server";

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler so an unhandled error becomes JSON instead of a 500
 * HTML page.
 *
 * Next hides server error details from the client by default, which is right
 * for a public app but leaves a single-user tool with an opaque "500" and no
 * way to tell a missing env var from a bad query. We return the message
 * deliberately. Stacks stay server-side, and the app is behind Cloudflare
 * Access in production.
 */
export function withErrors<P = Record<string, string>>(
  handler: (req: Request, ctx: Ctx<P>) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      let path = req.url;
      try {
        path = new URL(req.url).pathname;
      } catch {
        /* keep the raw url */
      }
      console.error(`[outpost] ${req.method} ${path} failed:`, e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
