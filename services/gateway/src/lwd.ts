import { LWD_METHODS, LWD_SERVICE, LWD_UPSTREAM, MAX_BODY_BYTES } from "./constants";

/**
 * `POST /lwd/<network>/<service>/<method>`: forwards a gRPC-web call to the light server.
 * Only the body and the gRPC-web content type go upstream: no cookies, no client IP, no headers
 * that could tie two requests to one person.
 */
export async function lwd(request: Request, parts: string[]): Promise<Response> {
  const [network, service, method] = parts;
  const upstream = network ? LWD_UPSTREAM[network] : undefined;
  if (request.method !== "POST" || !upstream || service !== LWD_SERVICE || !method || !LWD_METHODS.has(method)) {
    return new Response("not found", { status: 404 });
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) return new Response("too large", { status: 413 });
  const res = await fetch(`${upstream}/${service}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/grpc-web+proto", "x-grpc-web": "1" },
    body,
  });
  const headers = new Headers({ "content-type": res.headers.get("content-type") ?? "application/grpc-web+proto" });
  for (const h of ["grpc-status", "grpc-message"]) {
    const v = res.headers.get(h);
    if (v !== null) headers.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers });
}
