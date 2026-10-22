import { ALLOWED_ORIGINS, POLYMARKET_GEOBLOCK } from "./constants";
import { lwd } from "./lwd";

interface Geoblock {
  blocked: boolean;
  country: string;
  region: string;
}

/** CORS for Mitoshi's own origins only; every other origin gets no CORS headers. */
function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, x-grpc-web");
  headers.set("access-control-expose-headers", "grpc-status, grpc-message");
  headers.set("vary", "origin");
  return new Response(response.body, { status: response.status, headers });
}

async function geo(request: Request): Promise<Response> {
  const res = await fetch(POLYMARKET_GEOBLOCK, { headers: { accept: "application/json" } });
  if (!res.ok) return Response.json({ error: `geoblock check failed: ${res.status}` }, { status: 502 });
  const g = (await res.json()) as Geoblock;
  // Never echo the egress IP.
  return Response.json({
    blocked: g.blocked,
    country: g.country,
    region: g.region,
    placement: request.headers.get("cf-placement"),
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return withCors(request, new Response(null, { status: 204 }));
    const url = new URL(request.url);
    const [head, ...rest] = url.pathname.split("/").filter(Boolean);
    let response: Response;
    if (head === "lwd") response = await lwd(request, rest);
    else if (url.pathname === "/v1/geo") response = await geo(request);
    else response = new Response("not found", { status: 404 });
    return withCors(request, response);
  },
};
