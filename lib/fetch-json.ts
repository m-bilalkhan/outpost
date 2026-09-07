/**
 * Every call to our own API goes through here.
 *
 * `res.json()` on a response that is not JSON throws
 * "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON", which tells you
 * nothing. That happens whenever the server returns a page instead of data:
 * a route failed to compile, a dependency is missing, the dev server is not
 * running, or the URL 404'd. Read the body as text first so the real cause can
 * be reported.
 */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const method = init?.method ?? "GET";

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error(
      `Could not reach ${url}. Is the dev server still running?`,
    );
  }

  const text = await res.text();

  if (!text.trim()) {
    if (!res.ok) throw new Error(`${method} ${url} failed (${res.status})`);
    return null as T;
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        `The server returned a web page instead of data (${res.status}). ` +
          `Something is failing on the server — check the terminal running ` +
          `\`npm run dev\` for the real error. A missing dependency after a ` +
          `\`git pull\` is the usual cause: try \`npm install\`.`,
      );
    }
    throw new Error(
      `${method} ${url} returned something that is not JSON (${res.status}): ` +
        text.slice(0, 200),
    );
  }

  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : `${method} ${url} failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
