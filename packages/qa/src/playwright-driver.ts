import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { WebDriver } from "./web-types.js";

// Playwright is NOT a build-time dependency of @flow/qa. It is loaded lazily through a NON-LITERAL
// dynamic import, so the package compiles and its offline test suite runs without playwright (or any
// browser) installed. Install it only to use this driver:
//   npm i playwright && npx playwright install chromium
// The offline FakeWebDriver covers web-QA logic in the suite; this driver drives a real browser.

/** The slice of a Playwright Page we use — kept structural so we never import Playwright's types at build. */
interface PageLike {
  goto(url: string): Promise<unknown>;
  innerText(selector: string): Promise<string>;
  $(selector: string): Promise<unknown>;
  screenshot(options: { path: string }): Promise<unknown>;
  on(event: string, handler: (arg: unknown) => void): void;
}
interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}
interface Launcher {
  launch(options: { headless: boolean }): Promise<BrowserLike>;
}

export interface PlaywrightDriverOptions {
  browser?: "chromium" | "firefox" | "webkit";
  headless?: boolean;
}

/**
 * A {@link WebDriver} backed by a real Playwright browser. Feed it to `runWebQA` to verify web criteria
 * against a running app, capturing real screenshots, console and network as evidence. Requires
 * `playwright` and a browser binary to be installed; otherwise construction is fine but the first
 * navigation throws a clear, actionable error.
 */
export class PlaywrightDriver implements WebDriver {
  private browser: BrowserLike | undefined;
  private page: PageLike | undefined;
  private readonly consoleLog: string[] = [];
  private readonly networkLog: string[] = [];
  private readonly opts: PlaywrightDriverOptions;

  constructor(opts: PlaywrightDriverOptions = {}) {
    this.opts = opts;
  }

  private async ensurePage(): Promise<PageLike> {
    if (this.page !== undefined) return this.page;
    const moduleName = "playwright"; // non-literal at the import site → tsc does not resolve it
    let pw: Record<string, Launcher | undefined>;
    try {
      pw = (await import(moduleName)) as Record<string, Launcher | undefined>;
    } catch {
      throw new Error(
        "PlaywrightDriver requires 'playwright' — run: npm i playwright && npx playwright install chromium",
      );
    }
    const kind = this.opts.browser ?? "chromium";
    const launcher = pw[kind];
    if (launcher === undefined) {
      throw new Error(`unknown or unavailable browser '${kind}'`);
    }
    this.browser = await launcher.launch({ headless: this.opts.headless ?? true });
    const page = await this.browser.newPage();
    page.on("console", (m) => this.consoleLog.push(readText(m)));
    page.on("request", (r) => this.networkLog.push(readUrl(r)));
    this.page = page;
    return page;
  }

  async goto(url: string): Promise<void> {
    await (await this.ensurePage()).goto(url);
  }
  async pageText(): Promise<string> {
    return (await this.ensurePage()).innerText("body");
  }
  async hasSelector(selector: string): Promise<boolean> {
    return (await (await this.ensurePage()).$(selector)) !== null;
  }
  async screenshot(path: string): Promise<void> {
    mkdirSync(dirname(path), { recursive: true });
    await (await this.ensurePage()).screenshot({ path });
  }
  consoleMessages(): string[] {
    return this.consoleLog;
  }
  networkRequests(): string[] {
    return this.networkLog;
  }
  async close(): Promise<void> {
    if (this.browser !== undefined) {
      await this.browser.close();
      this.browser = undefined;
      this.page = undefined;
    }
  }
}

/** Best-effort text of a Playwright ConsoleMessage without importing its type. */
function readText(message: unknown): string {
  const m = message as { text?: () => string };
  return typeof m.text === "function" ? m.text() : String(message);
}
/** Best-effort url of a Playwright Request without importing its type. */
function readUrl(request: unknown): string {
  const r = request as { url?: () => string };
  return typeof r.url === "function" ? r.url() : String(request);
}
