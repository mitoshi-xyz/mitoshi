import { POLYMARKET_GEOBLOCK } from "./constants";

interface Geoblock {
  blocked: boolean;
  country: string;
  region: string;
}

/**
 * S1 spike: proves the gateway's egress passes Polymarket's API geoblock.
 * Only `blocked`, `country` and `region` are returned; the egress IP is never echoed.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/v1/geo") {
      return new Response("not found", { status: 404 });
    }
    const res = await fetch(POLYMARKET_GEOBLOCK, { headers: { accept: "application/json" } });
    if (!res.ok) {
      return Response.json({ error: `geoblock check failed: ${res.status}` }, { status: 502 });
    }
    const geo = (await res.json()) as Geoblock;
    const placement = request.headers.get("cf-placement");
    return Response.json({ blocked: geo.blocked, country: geo.country, region: geo.region, placement });
  },
};
