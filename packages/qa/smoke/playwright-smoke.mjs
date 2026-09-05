// Live-browser smoke for @flow/qa's PlaywrightDriver. NOT part of the offline `npm test` (it needs a
// real browser). Run it after: npm run build && npm i playwright && npx playwright install chromium
//   node packages/qa/smoke/playwright-smoke.mjs
// It serves a tiny page, drives it with a real browser through runWebQA, and asserts the report.
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWebQA, PlaywrightDriver } from "../dist/index.js";

const html = `<!doctype html><html><body><div id="app">Welcome HELLO from a real browser</div></body></html>`;
const server = createServer((_req, res) => {
  res.setHeader("content-type", "text/html");
  res.end(html);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const evidenceDir = mkdtempSync(join(tmpdir(), "flow-qa-pw-smoke-"));

const driver = new PlaywrightDriver({ headless: true });
let code = 1;
try {
  const report = await runWebQA(
    {
      target: base,
      platform: "web",
      criteria: [
        {
          id: "home",
          description: "home renders the greeting in a real browser",
          steps: [
            { kind: "goto", url: "/" },
            { kind: "expectText", text: "HELLO" },
            { kind: "expectSelector", selector: "#app" },
            { kind: "screenshot", name: "home" },
          ],
        },
        {
          id: "missing",
          description: "a deliberately failing check produces a ticket + failure screenshot",
          severity: "critical",
          steps: [
            { kind: "goto", url: "/" },
            { kind: "expectText", text: "THIS TEXT IS NOT ON THE PAGE" },
          ],
        },
      ],
    },
    driver,
    { evidenceDir },
  );
  console.log(JSON.stringify({ summary: report.summary, complete: report.complete, evidenceDir: report.evidenceDir }, null, 2));
  const home = report.criteria.find((c) => c.id === "home");
  const missing = report.criteria.find((c) => c.id === "missing");
  const ok =
    home?.status === "pass" &&
    missing?.status === "fail" &&
    (missing?.tickets.length ?? 0) === 1 &&
    report.complete === false;
  console.log(ok ? "SMOKE OK: real browser drove the page, evidence captured, ticket filed" : "SMOKE FAILED");
  code = ok ? 0 : 1;
} finally {
  await driver.close();
  server.close();
}
process.exit(code);
