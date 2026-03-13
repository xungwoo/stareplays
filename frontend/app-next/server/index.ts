import Fastify from "fastify";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3100);

async function start() {
  const nextApp = next({ dev, hostname: host, port, dir: process.cwd() });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  const server = Fastify({ logger: true });

  server.get("/healthz", async () => ({ status: "ok" }));

  server.all("/*", async (request, reply) => {
    await handle(request.raw, reply.raw);
    reply.hijack();
  });

  await server.listen({ host, port });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
