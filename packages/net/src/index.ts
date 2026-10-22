import { RELAY_PATHS } from "./constants";

export { GATEWAY_KEY_CONFIG, RELAY_PATHS } from "./constants";
export { createPrivateFetch, type PrivateFetch } from "./private-fetch";

/** A picture's URL through the relay's image proxy (no image host ever sees the browser). */
export function proxiedImage(relayBase: string, src: string): string {
  return `${relayBase}${RELAY_PATHS.img}?u=${encodeURIComponent(src)}`;
}
