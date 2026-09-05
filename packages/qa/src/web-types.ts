export type WebStep =
  | { kind: "goto"; url: string }
  | { kind: "expectText"; text: string }
  | { kind: "expectSelector"; selector: string }
  | { kind: "screenshot"; name?: string };

export interface WebCriterion {
  id: string;
  description: string;
  steps: WebStep[];
  severity?: "low" | "medium" | "high" | "critical";
  tags?: string[];
}

export interface WebQARequest {
  /** Base URL; a `goto` step's url may be absolute or relative to this. */
  target: string;
  platform: string;
  criteria: WebCriterion[];
}

/**
 * Abstracts a browser so web QA can run against a real Playwright browser (later) or a deterministic
 * FakeWebDriver (offline tests). QA never imports Playwright directly.
 */
export interface WebDriver {
  goto(url: string): Promise<void>;
  pageText(): Promise<string>;
  hasSelector(selector: string): Promise<boolean>;
  screenshot(path: string): Promise<void>;
  consoleMessages(): string[];
  networkRequests(): string[];
  close(): Promise<void>;
}
