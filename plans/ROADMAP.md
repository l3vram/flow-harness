# Roadmap — from coding agent to autonomous software factory

The headline metric for this project is **not** the count of packages, agents, or tools. It is one
end-to-end test, run repeatedly on **different** specs:

> Build a new web app from a spec: research what's needed, design the architecture and plan,
> implement front+back, run tests, launch the app, exercise the main flows with Playwright, detect
> and repair errors, verify every requirement with objective evidence, open a branch and a PR — and
> **refuse to mark the project done if any critical requirement is not objectively verified.**

When the harness passes that on several distinct projects, it is a software factory, not a coding
agent. Everything below is ordered to reach exactly that.

Status legend: ✅ done · 🚧 partial (skeleton exists, gap noted) · ⬜ not started.
This roadmap is the actionable, prioritized execution plan; `PLAN.md` remains the architecture
treatise and `STATUS.md` the milestone tracker.

## Priority 0 — make it a *verifiable* factory

1. **QA Engine** ⬜ — unit / integration / API / E2E; **Playwright** for web; automatic **evidence**
   (screenshots, traces, console, network, results). *Today:* verification is a single deterministic
   `verifyCommand` run by the executor — no dedicated QA package, no browser evidence. The big next one.
   **Architecture ([ADR 0007](../docs/decisions/0007-qa-independent-capability.md)):** build it independent
   on the standard seam — pure lib `@flow/qa` → bin `flow-qa` → MCP tool `flow_qa` — so it is usable
   standalone *or* composed. `flow_qa` is **run-less**: input `{target, acceptance criteria/suite, platform}`
   → a serializable **QA report** (per-criterion pass/fail + evidence artifacts on disk + error **tickets**).
   QA emits evidence/verdicts/tickets, not decisions (the CEO decides fixes). Ship in layers: **A** suites →
   **B** Playwright web → **C** mobile (later); package+bin → MCP → wire into the orchestrator, like v0.16.
2. **Requirement → Evidence → Done** 🚧 — every requirement has acceptance criteria, every criterion has
   a verification, `DONE` only with objective evidence; never "the agent says it works." *Today:*
   `@flow/planner` emits `spec.acceptance[]` + per-task `verify[]`, and DONE already gates on a real
   `verify.ok` (this is an existing invariant, not the agent's word). *Gap:* criteria aren't individually
   mapped to a verification + stored evidence artifact.
3. **Strong convergence** 🚧 — compare spec vs the *real* implementation; detect pending / partially
   implemented / contradictory requirements; block `complete` while critical requirements are unverified.
   *Today:* `@flow/converge` compares plan tasks vs outcomes (done/pending/complete, open clarifications).
   *Gap:* it's task-status-based, not a deep spec-vs-impl diff; no "partial"/"contradiction"/"critical" notion.

## Priority 1 — make it truly autonomous

4. **Dynamic replanning** ⬜ — the DAG must not be static: `create / split / replace / invalidate / replan`;
   the CEO can revise the plan when implementation reveals new information. *Today:* tasks are fixed at run
   start; the CEO's actions are only dispatch/advance/await_human/complete. Real gap; unblocks #7.
5. **Research Engine** ⬜ — web / GitHub / docs / package registries; research before implementing under
   uncertainty; store findings + sources as artifacts. *Today:* none in the harness.
6. **Evaluation Engine** ⬜ — score each run objectively: correctness, tests, requirements, regressions,
   security, UX, cost; compare runs across versions. *Today:* `@flow/review` scores *risk* pre-execution
   and the ledger tracks cost — neither evaluates outcome quality. (Note: define "UX" concretely, e.g.
   from Playwright a11y/heuristics, or it stays unmeasurable.)
7. **Repair → Replan** 🚧 — after N repair attempts: `repair → diagnose → replan → new tasks`; escalate to
   a human only when truly needed. *Today:* the repair loop exists (bounded → blocked → human gate) but
   there is no diagnose→replan step. Depends on #4.

## Priority 2 — make it actually learn

8. **Structured memory** 🚧 — Working / Project / Episodic / Procedural / Policy; not all in the prompt;
   ranked by relevance + evidence + freshness + confidence. *Today:* `@flow/memory` is a flat lessons
   JSONL + term-overlap search recalled top-K. *Gap:* no typing, freshness, or confidence.
9. **Controlled learning** ⬜ — `observation → candidate lesson → repeated evidence → validation →
   promoted policy`; a lesson is not auto-promoted to a rule. *Today:* every run records one lesson
   unconditionally — no promotion pipeline.
10. **Knowledge graph** ⬜ — relate requirements ↔ tasks ↔ files ↔ tests ↔ failures ↔ evidence ↔ lessons;
    this sharply improves the context the CEO receives. *Today:* relations are implicit only.

## Priority 3 — security / autonomy

11. **Capability-based agents** ⬜ — explicit per-role permissions (QA → run/browser/test, Backend → backend
    code, Security → analysis); no agent can do anything. *Today:* roles are labels with no permission model.
12. **Risk Engine 2.0** 🚧 — security, architecture, data, production impact, migrations, external APIs,
    destructive operations; high risk → evidence + human review. *Today:* `@flow/review.assessRisk` is v1
    (security surface + complexity → level + human gate); the richer categories aren't modeled yet.
13. **Strong sandboxing** 🚧 — isolated filesystem, an allowed-command list, network policy, secrets never
    exposed to the model unless explicitly needed. *Today:* writes are path-confined to `targetDir`, Docker
    isolates runs, and the verify command comes from config (not the model). *Gap:* no network policy, no
    runtime command allowlist, no managed secret boundary.

## Priority 4 — productization

14. **Full Git/PR workflow** 🚧 — `run → worktree → implementation → QA → evidence → review → commit → PR`.
    *Today:* `@flow/git` does worktree + commit + a branch "PR gate." *Gap:* no QA/evidence step in the
    chain, and no actual PR creation (leaves a branch; doesn't open a PR). Note the worktree/`node_modules`
    limitation (monorepo worktrees don't share deps).
15. **Deployment verification** ⬜ — passing locally isn't enough: deploy to a temporary environment and run
    smoke/E2E against the real deployment. *Today:* none.
16. **Observability** 🚧 — cost, tokens, models used, time, retries, failures, success rate, which tasks needed
    a human. *Today:* the ledger tracks tokens/cost by phase/tier/plan and reports attempts/statuses. *Gap:*
    no aggregated success-rate / time / model / human-intervention metrics.
17. **Remote execution** 🚧 — run the harness as a remote service / MCP, keeping local as an option. *Today:*
    the MCP server is local stdio only; HTTP transport + a daemon are future.

## Implementation order (as specified — sound; dependencies respected)

```
1 QA → 2 Evidence → 3 Requirement→Verification graph → 4 Convergence(strong)
→ 5 Dynamic replanning → 6 Research → 7 Evaluation → 8 Repair+Replan
→ 9 Structured memory → 10 Controlled learning → 11 Knowledge graph
→ 12 Security/capabilities → 13 Deployment verification → 14 Observability → 15 Remote execution
```

(Ordering note: items 2 and 3 above are numbered 3 and 4 in this sequence — Evidence is split out ahead of
the requirement→verification graph. Repair+Replan (#7 in the sequence) depends on dynamic replanning; strong
convergence depends on the evidence graph; evaluation depends on QA evidence — the order honors these.)

## Alignment verdict

The list is coherent and on-mission — nothing here is a feature for its own sake, and the ordering
("verifiable factory" before "autonomous" before "learns" before "hardened" before "productized") matches
this repo's founding invariant: *judgment lives in the LLM, but truth is deterministic evidence, never the
agent's say-so.* Adopted as the project roadmap; the software-factory test above is the primary metric.
