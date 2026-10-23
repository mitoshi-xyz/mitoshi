import { PRIVATE_IMAGE_HOST, RELAY_PATHS } from "./constants";

export { GATEWAY_KEY_CONFIG, PRIVATE_IMAGE_HOST, RELAY_PATHS } from "./constants";
export { createPrivateFetch, type PrivateFetch } from "./private-fetch";

/**
 * A picture's URL through the relay's image proxy (no image host ever sees the browser). The relay sees which picture,
 * so this is for what everyone sees alike (lists, market pages); see privateImageUrl for what a user holds.
 */
export function proxiedImage(relayBase: string, src: string): string {
  return `${relayBase}${RELAY_PATHS.img}?u=${encodeURIComponent(src)}`;
}

/** The OHTTP target for a picture of something the user holds: fetch it with a PrivateFetch, so the relay sees nothing. */
export function privateImageUrl(src: string): string {
  return `https://${PRIVATE_IMAGE_HOST}${RELAY_PATHS.img}?u=${encodeURIComponent(src)}`;
}
