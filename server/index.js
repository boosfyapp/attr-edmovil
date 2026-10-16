import { createApp } from "./app.js";
import { loadConfig } from "./lib/config.js";

const config = loadConfig();
const server = createApp(config);
server.listen(config.port, () => {
  console.log(`[att-redmovil] escuchando en :${config.port} · datos en ${config.dataDir}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
