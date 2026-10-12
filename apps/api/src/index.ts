import Fastify from "fastify";

const fastify = Fastify({
  logger: true,
});

fastify.get("/health", async () => {
  return {
    status: "ok",
    service: "dj-assistant-api",
    timestamp: new Date().toISOString(),
  };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`DJ Assistant API server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  start();
}

export default fastify;
