import { buildApp } from "./app.js";
import { ensureSuperadmin } from "./bootstrap/ensure-superadmin.js";
import { env } from "./config/env.js";

const app = buildApp();

try {
  await ensureSuperadmin();
  app.log.info(
    { usuario: env.BOOTSTRAP_SUPERADMIN_USER },
    "bootstrap superadmin ensured",
  );
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`server running on port ${env.PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
