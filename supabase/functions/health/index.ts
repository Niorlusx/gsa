/**
 * Public health check — no credentials required.
 * auth: 'none' is intentional (no user data).
 */
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "none" }, async (_req, _ctx) => {
    return Response.json({
      ok: true,
      service: "gsa",
      project: "knqcjedftfgmnhdgjnoo",
    });
  }),
};
