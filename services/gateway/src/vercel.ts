import { type Env, handle } from "./app";

/** Vercel Functions entry (Web handler). Region: dub1, set in vercel.json. */
export default {
  fetch(request: Request): Promise<Response> {
    return handle(request, process.env as Env);
  },
};
