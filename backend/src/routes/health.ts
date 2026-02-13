import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async (_request, reply) => {
    let db: "ok" | "degraded" = "ok";
    let cache: "ok" | "degraded" = "ok";

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "degraded";
    }

    try {
      await redis.ping();
    } catch {
      cache = "degraded";
    }

    const statusCode = db === "ok" && cache === "ok" ? 200 : 503;

    return reply.code(statusCode).send({
      status: statusCode === 200 ? "ok" : "degraded",
      db,
      redis: cache,
      timestamp: new Date().toISOString(),
    });
  });
};
