/**
 * The gateway's OHTTP key configuration (application/ohttp-keys), pinned in the app so the relay
 * cannot swap in a key of its own. Anyone can compare it with https://mitoshi-gateway.vercel.app/ohttp-keys.
 */
export const GATEWAY_KEY_CONFIG = "ACkBACAV5em/Jd6iTp3ZtsO+Q8c6/nXzvtWg04Rq5UUC675KYwAEAAEAAQ==";

/** The largest request or response carried in one OHTTP message (matches the gateway). */
export const OHTTP_MAX_MESSAGE_BYTES = 8 * 1024 * 1024;

/** Relay paths, under the relay base. */
export const RELAY_PATHS = { ohttp: "/ohttp", img: "/img" } as const;

/** The gateway's image route as an OHTTP target (it handles this name itself; nothing resolves it). */
export const PRIVATE_IMAGE_HOST = "img.mitoshi.internal";
