import { Hono } from "hono";
import { csrf } from "hono/csrf";
import type { AppEnv, Env } from "./env";
import { auth, requireUser } from "./auth";
import { accounts } from "./accounts";

const app = new Hono<AppEnv>().basePath("/api");

app.use(csrf());
app.route("/auth", auth);
app.get("/me", requireUser, async (c) => {
  const user = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(c.get("userId")).first<{ email: string }>();
  return c.json(user);
});
app.route("/accounts", accounts);

export default {
  fetch: app.fetch,
  async scheduled(_event, env) {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM login_tokens WHERE expires_at < ?").bind(now),
      env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
    ]);
  },
} satisfies ExportedHandler<Env>;
