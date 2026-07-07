import Router from "@koa/router";
import { ROLE } from "../entity/user";
import permission from "../middleware/permission";
import {
  evaluateDiscordBotManifest,
  getDiscordHostingOverview,
  updateDiscordHostingSettings,
  type DiscordBotManifest,
  type DiscordHostingSettings
} from "../service/discord_hosting";

const router = new Router({ prefix: "/discord_hosting" });

router.get("/overview", permission({ level: ROLE.USER }), async (ctx) => {
  ctx.body = getDiscordHostingOverview();
});

router.post("/preflight", permission({ level: ROLE.USER }), async (ctx) => {
  const manifest = ctx.request.body as Partial<DiscordBotManifest>;
  ctx.body = evaluateDiscordBotManifest(manifest || {});
});

router.put("/settings", permission({ level: ROLE.ADMIN }), async (ctx) => {
  const settings = ctx.request.body as Partial<DiscordHostingSettings>;
  ctx.body = updateDiscordHostingSettings(settings || {});
});

export default router;
