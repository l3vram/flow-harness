#!/usr/bin/env node
import { main } from "./server.js";

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + "\n");
  process.exit(1);
});
