import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { WebDriver } from "./web-types.js";

/** Scripted page state for the FakeWebDriver. */
export interface FakeWebState {
  /** Text that `pageText()` returns. */
  text?: string;
  /** Selectors that `hasSelector()` reports as present. */
  selectors?: string[];
  console?: string[];
  network?: string[];
}

/** A deterministic, offline WebDriver for tests — the browser analogue of FakeProvider. */
export class FakeWebDriver implements WebDriver {
  public readonly visited: string[] = [];
  private readonly state: FakeWebState;

  constructor(state: FakeWebState = {}) {
    this.state = state;
  }

  async goto(url: string): Promise<void> {
    this.visited.push(url);
  }
  async pageText(): Promise<string> {
    return this.state.text ?? "";
  }
  async hasSelector(selector: string): Promise<boolean> {
    return (this.state.selectors ?? []).includes(selector);
  }
  async screenshot(path: string): Promise<void> {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "fake-screenshot", "utf8");
  }
  consoleMessages(): string[] {
    return this.state.console ?? [];
  }
  networkRequests(): string[] {
    return this.state.network ?? [];
  }
  async close(): Promise<void> {
    // no-op
  }
}
