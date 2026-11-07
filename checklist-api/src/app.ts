import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createHash } from "node:crypto";
import {
  resolve,
  search,
  type Answers,
  type Snapshot,
} from "@townpass/checklist-shared";

export function buildApp(
  getSnapshot: () => Snapshot,
  origins = ["http://localhost:5173", "http://127.0.0.1:5173"],
) {
  // Search text and condition answers can contain private information; never log request URLs or bodies.
  const app = Fastify({
    logger: false,
    bodyLimit: 8192,
    requestTimeout: 15000,
    ajv: { customOptions: { removeAdditional: false } },
  });
  const problem = (statusCode: number, title: string) =>
    Object.assign(new Error(title), { statusCode });
  app.register(cors, {
    origin(origin, callback) {
      callback(
        origin && !origins.includes(origin)
          ? problem(403, "不允許此來源")
          : null,
        true,
      );
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
    exposedHeaders: ["ETag", "X-Snapshot-Version"],
  });
  app.register(helmet);
  app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.setErrorHandler((error, _request, reply) => {
    const err = error as Error & { statusCode?: number; validation?: unknown };
    const status =
      err.statusCode && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;
    reply
      .header("Cache-Control", "no-store")
      .code(status)
      .type("application/problem+json")
      .send({
        type: "about:blank",
        title:
          status === 500
            ? "服務暫時無法使用"
            : err.validation
              ? "參數格式不正確"
              : err.message,
        status,
      });
  });
  app.setNotFoundHandler((_req, reply) =>
    reply
      .code(404)
      .header("Cache-Control", "no-store")
      .type("application/problem+json")
      .send({ type: "about:blank", title: "找不到此 API", status: 404 }),
  );
  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Snapshot-Version", getSnapshot().version);
    if (
      request.method === "GET" &&
      reply.statusCode === 200 &&
      request.url.startsWith("/v1/")
    ) {
      reply.header(
        "Cache-Control",
        "public, max-age=60, stale-while-revalidate=600, stale-if-error=86400",
      );
      const etag = `"${createHash("sha256")
        .update(typeof payload === "string" ? payload : "")
        .digest("hex")}"`;
      reply.header("ETag", etag);
      if (request.headers["if-none-match"] === etag) {
        reply.code(304);
        return "";
      }
    }
    return payload;
  });
  app.get("/health", async () => ({
    status: "ok",
    snapshotVersion: getSnapshot().version,
  }));
  const querySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      q: { type: "string", maxLength: 30 },
      category: { type: "string", maxLength: 30 },
      limit: { type: "integer", minimum: 1, maximum: 10 },
      page: { type: "integer", minimum: 1, maximum: 1000 },
      size: { type: "integer", minimum: 1, maximum: 50 },
    },
  };
  app.post<{ Body: { q: string } }>(
    "/v1/search",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["q"],
          properties: { q: { type: "string", minLength: 1, maxLength: 30 } },
        },
      },
    },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const snapshot = getSnapshot();
      const items = search(snapshot.services, request.body.q);
      return { snapshotVersion: snapshot.version, total: items.length, items };
    },
  );
  for (const route of ["/v1/suggest", "/v1/search", "/v1/services"])
    app.get<{
      Querystring: {
        q?: string;
        category?: string;
        limit?: number;
        page?: number;
        size?: number;
      };
    }>(route, { schema: { querystring: querySchema } }, async (request) => {
      const snapshot = getSnapshot();
      const {
        q = "",
        category,
        page = 1,
        size = 20,
        limit = 8,
      } = request.query;
      if (route === "/v1/suggest" && !q.trim())
        throw problem(400, "請輸入 1 至 30 字的業務關鍵字");
      const items = search(snapshot.services, q).filter(
        (s) => !category || s.category === category,
      );
      return {
        snapshotVersion: snapshot.version,
        total: items.length,
        items:
          route === "/v1/suggest"
            ? items.slice(0, limit)
            : items.slice((page - 1) * size, page * size),
      };
    });
  app.get("/v1/categories", async () => ({
    items: [
      ...new Set(
        getSnapshot()
          .services.filter((s) => !s.retired)
          .map((s) => s.category),
      ),
    ].map((name) => ({
      name,
      count: getSnapshot().services.filter(
        (s) => !s.retired && s.category === name,
      ).length,
    })),
  }));
  const serviceBySlug = (slug: string) => {
    const service = getSnapshot().services.find((s) => s.slug === slug);
    if (!service) throw problem(404, "找不到這項業務");
    if (service.retired) throw problem(410, "業務已下架，請洽承辦機關");
    return service;
  };
  const slugSchema = {
    type: "object",
    required: ["slug"],
    properties: {
      slug: {
        type: "string",
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        maxLength: 80,
      },
    },
  };
  app.get<{ Params: { slug: string } }>(
    "/v1/services/:slug",
    { schema: { params: slugSchema } },
    async (request) => ({
      snapshotVersion: getSnapshot().version,
      service: serviceBySlug(request.params.slug),
    }),
  );
  app.get<{ Params: { slug: string }; Querystring: { mode: string } }>(
    "/v1/services/:slug/checklist",
    {
      schema: {
        params: slugSchema,
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["mode"],
          properties: {
            mode: { type: "string", enum: ["SELF", "DELEGATE", "LEGAL_REP"] },
          },
        },
      },
    },
    async (request) => {
      const service = serviceBySlug(request.params.slug);
      if (!service.modes.some((m) => m.code === request.query.mode))
        throw problem(422, "此業務未提供此辦理方式");
      return {
        snapshotVersion: getSnapshot().version,
        checklist: resolve(service, request.query.mode),
      };
    },
  );
  // Conditions stay in a non-cacheable POST body, never in public URLs or access logs.
  app.post<{
    Params: { slug: string };
    Body: { mode: string; answers: Answers };
  }>(
    "/v1/services/:slug/checklist",
    {
      schema: {
        params: slugSchema,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["mode", "answers"],
          properties: {
            mode: { type: "string", enum: ["SELF", "DELEGATE", "LEGAL_REP"] },
            answers: {
              type: "object",
              maxProperties: 30,
              additionalProperties: {},
            },
          },
        },
      },
    },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const service = serviceBySlug(request.params.slug);
      if (!service.modes.some((m) => m.code === request.body.mode))
        throw problem(422, "此業務未提供此辦理方式");
      for (const [code, value] of Object.entries(request.body.answers)) {
        const q = service.questions.find((q) => q.code === code);
        if (
          !q ||
          !(q.type === "BOOLEAN"
            ? typeof value === "boolean"
            : q.options?.some((o) => o.value === value))
        )
          throw problem(400, "問題代碼或答案無效");
      }
      return {
        snapshotVersion: getSnapshot().version,
        checklist: resolve(service, request.body.mode, request.body.answers),
      };
    },
  );
  return app;
}
