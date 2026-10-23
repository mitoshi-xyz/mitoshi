import { createPrivateFetch, privateImageUrl } from "@mitoshi/net";
import { RELAY } from "@/constants";

const fetchPrivately = createPrivateFetch(RELAY);
/** One fetch per picture per session; the object URLs live as long as the page. */
const cache = new Map<string, Promise<string | null>>();

/**
 * A picture of something the user holds, fetched over OHTTP and kept as a blob: URL. Through the relay's public image
 * proxy, the relay would see this IP next to the icons of every token and stock in its wallets.
 */
export function privateImage(src: string): Promise<string | null> {
  let url = cache.get(src);
  if (!url) {
    url = fetchPrivately(privateImageUrl(src))
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null);
    cache.set(src, url);
  }
  return url;
}
