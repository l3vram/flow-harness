# Flow Dev Company — Harness v2
## Architecture & Implementation Plan

> **Status:** Architecture plan / implementation roadmap
>
> **Base:** `master` at commit `d4c96f2`
>
> **Objective:** Evolve `flow-dev-company` from a Claude Code-specific development skill into an LLM-agnostic software engineering harness with persistent memory, executive reasoning, deterministic orchestration, autonomous verification, browser/mobile QA, evidence, evaluation, controlled learning, and MCP interoperability.

---

# 1. Vision

Transform `flow-dev-company` into an LLM-agnostic AI software-development harness.

The harness coordinates the complete engineering lifecycle:

```text
Intent
  ↓
Understand
  ↓
Research
  ↓
Plan
  ↓
Decide
  ↓
Execute
  ↓
Verify
  ↓
QA
  ↓
Review
  ↓
Repair / Replan
  ↓
Learn
  ↓
Complete
```

The LLM is an interchangeable reasoning engine.

The harness owns:

- orchestration
- state
- memory
- context engineering
- planning
- task decomposition
- scheduling
- model routing
- tool execution
- QA
- evidence
- evaluation
- learning
- cost control
- recovery
- auditability

MCP is the primary interoperability interface, not the internal architecture.

---

# 2. Design principles

## 2.1 LLMs are workers, not the system

The system must not depend on Claude-specific concepts such as:

- `Agent`
- `AskUserQuestion`
- `TaskCreate`
- `TaskList`
- `SendMessage`
- Claude-specific model names
- Claude-specific skill loading

Provider-specific concepts belong behind adapters.

## 2.2 Deterministic control flow belongs in code

The current project correctly moved DAG layering, state transitions, circuit breakers, panels and budget accounting into deterministic code.

v2 preserves that philosophy but moves the deterministic core into a typed runtime.

The LLM decides:

> What should happen?

The runtime decides:

> How should that decision be executed safely and reproducibly?

## 2.3 Evidence beats assertions

Agents may report conclusions, but important conclusions should be backed by tool-derived evidence.

Bad:

```text
Agent: "The checkout works."
```

Good:

```text
Playwright:
  scenario: checkout
  status: PASS
  screenshot: evidence/...
  trace: evidence/...
  network: ...
  console: ...
```

---

# 3. Target architecture

```text
                         HUMAN
                           │
                           ▼
                 ┌──────────────────┐
                 │       CEO        │
                 │ Executive Agent  │
                 └────────┬─────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   Context Engine      Research          Risk Engine
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                    Planning Engine
                          │
                          ▼
                       Task DAG
                          │
                       Scheduler
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
           Backend     Frontend      Data
              │           │           │
              └───────────┼───────────┘
                          ▼
                       QA Engine
              ┌───────────┼───────────┐
              ▼           ▼           ▼
          Unit/API    Playwright    Emulator
              │           │           │
              └───────────┼───────────┘
                          ▼
                       Evidence
                          │
                          ▼
                    Review Engine
                          │
                          ▼
                    Learning Engine
                          │
                          ▼
                    Project Memory
                          │
                          └──────────► CEO
```

Infrastructure:

```text
                 ┌─────────────────────┐
                 │    Model Router     │
                 ├─────────────────────┤
                 │ Claude              │
                 │ OpenAI              │
                 │ Gemini              │
                 │ Local models        │
                 │ OpenAI-compatible   │
                 └─────────────────────┘

                 ┌─────────────────────┐
                 │    Event Store      │
                 └─────────────────────┘

                 ┌─────────────────────┐
                 │ Token / Cost Ledger │
                 └─────────────────────┘

                 ┌─────────────────────┐
                 │    MCP Adapter      │
                 └─────────────────────┘
```

---

# 4. Runtime

Recommended initial implementation:

```text
TypeScript
Node.js
MCP TypeScript SDK
pnpm monorepo
```

Reasons:

- strong MCP ecosystem
- ideal integration with Playwright
- strong filesystem/process/Git support
- typed schemas
- easy local and remote deployment
- straightforward provider adapters

Python remains possible later through adapters but is not required by the core.

---

# 5. Repository structure

Target:

```text
flow-dev-company/
│
├── packages/
│   ├── core/
│   ├── runtime/
│   ├── mcp-server/
│   ├── model-router/
│   ├── context/
│   ├── memory/
│   ├── planner/
│   ├── scheduler/
│   ├── agents/
│   ├── research/
│   ├── qa/
│   │   ├── playwright/
│   │   ├── api/
│   │   ├── mobile/
│   │   └── visual/
│   ├── evidence/
│   ├── evaluation/
│   ├── learning/
│   ├── security/
│   └── cli/
│
├── docs/
│   ├── architecture/
│   ├── decisions/
│   ├── workflows/
│   └── protocols/
│
├── examples/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── conformance/
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

# 6. Core domain model

Introduce explicit domain objects:

```text
Run
Goal
Project
Requirement
Decision
Task
Plan
AgentRun
Artifact
Evidence
Finding
Risk
Verification
TestCase
Memory
Lesson
Policy
ModelInvocation
ToolInvocation
Event
Metric
```

Relationship:

```text
Run
 ├── Goal
 ├── Requirements
 ├── Decisions
 ├── Tasks
 ├── AgentRuns
 ├── Evidence
 ├── Findings
 ├── Verifications
 ├── Metrics
 └── Lessons
```

---

# 7. Event-sourced runtime state

Do not rely exclusively on `.flow/state.json`.

Target:

```text
.flow/
  events.jsonl
  state.json
  runs/
  memory/
  evidence/
```

`events.jsonl` is the durable event history.

Example:

```json
{
  "event": "task.created",
  "runId": "...",
  "taskId": "...",
  "timestamp": "...",
  "data": {}
}
```

Core events:

```text
run.started
goal.refined
research.started
research.completed
decision.created
plan.created
task.created
task.started
agent.started
tool.called
tool.completed
task.failed
verification.failed
qa.failed
finding.created
task.replanned
task.completed
run.completed
lesson.created
policy.candidate
policy.promoted
```

`state.json` becomes a projection optimized for fast access.

---

# 8. CEO / Executive Engine

The CEO is the highest-level decision maker.

Responsibilities:

1. understand objective
2. identify ambiguity
3. determine whether research is required
4. determine required expertise
5. establish requirements
6. establish constraints
7. establish strategy
8. create task DAG
9. prioritize work
10. select models
11. delegate execution
12. inspect evidence
13. replan when assumptions fail
14. decide whether the goal is achieved
15. produce final outcome
16. trigger learning

The CEO must not directly edit product code.

Structured output:

```json
{
  "decision": "execute",
  "reason": "...",
  "tasks": [],
  "research": [],
  "risks": [],
  "required_evidence": [],
  "confidence": 0.91
}
```

---

# 9. CEO operating loop

```text
OBSERVE
  ↓
UNDERSTAND
  ↓
DECIDE
  ↓
PLAN
  ↓
DELEGATE
  ↓
OBSERVE RESULTS
  ↓
EVALUATE
  ↓
LEARN
  ↓
DECIDE AGAIN
```

The workflow must allow returning to previous phases.

The initial plan is not immutable.

---

# 10. Dynamic DAG

Retain the existing Kahn-based wave scheduler.

Make the DAG mutable.

Tasks can:

```text
create dependency
create new task
split task
merge tasks
invalidate task
replace task
escalate task
```

Example:

```text
Task A
  ↓
Task B
  ↓
Task C

B discovers external dependency.

CEO:

B
├── Research D
└── Implement B

D
 ↓
B
 ↓
C
```

The scheduler recalculates waves deterministically.

---

# 11. Agent system

Agents become typed roles.

Initial roles:

```text
architect
researcher
backend
frontend
data
devops
security
performance
qa
test-engineer
documentation
debugger
release-manager
```

Each role has:

```text
capabilities
constraints
preferred models
tool permissions
risk limits
output schema
```

Example:

```json
{
  "role": "qa",
  "capabilities": [
    "write_tests",
    "run_tests",
    "playwright",
    "analyze_evidence"
  ],
  "forbidden": [
    "modify_product_code"
  ]
}
```

---

# 12. Model Router

Replace hardcoded model tiers such as `haiku / sonnet / opus` with provider-neutral `ModelProfile`.

Example:

```json
{
  "provider": "anthropic",
  "model": "...",
  "capabilities": {
    "reasoning": 0.95,
    "coding": 0.90,
    "vision": 0.80,
    "context": 0.90
  },
  "cost": {
    "input": "...",
    "output": "..."
  }
}
```

Router inputs:

```text
task complexity
risk
required context
tool requirements
latency
cost
previous model performance
```

---

# 13. Provider abstraction

Implement:

```text
LLMProvider
 ├── AnthropicProvider
 ├── OpenAIProvider
 ├── GeminiProvider
 ├── OpenAICompatibleProvider
 └── LocalProvider
```

The core must never import provider-specific SDKs directly.

---

# 14. Context Engine

Build:

```text
ContextRequest
 ↓
Retriever
 ↓
Relevance ranking
 ↓
Deduplication
 ↓
Compression
 ↓
Context assembly
```

Context sources:

```text
current task
requirements
architecture
decisions
relevant files
recent failures
relevant lessons
tool evidence
test results
repository conventions
```

Output:

```json
{
  "context": [],
  "sources": [],
  "tokenBudget": 8000,
  "estimatedTokens": 6200
}
```

---

# 15. Project knowledge graph

Create a structured project model:

```text
Project
 ├── Components
 ├── Services
 ├── APIs
 ├── Database
 ├── Dependencies
 ├── Tests
 ├── UI
 ├── Infrastructure
 ├── Requirements
 ├── Decisions
 └── Risks
```

Goal: reduce cold-repository exploration and improve context selection.

---

# 16. Memory

Separate memory into layers:

```text
Working Memory
 └── current run

Project Memory
 └── current project

Organizational Memory
 └── reusable engineering knowledge

Procedural Memory
 └── successful workflows

Episodic Memory
 └── previous runs

Policy Memory
 └── learned rules
```

Memory must be independent of the selected LLM.

---

# 17. Memory retrieval

Never inject all memory automatically.

Pipeline:

```text
query
 ↓
candidate memories
 ↓
relevance
 ↓
confidence
 ↓
freshness
 ↓
scope
 ↓
top-K
```

Memory entry:

```json
{
  "type": "lesson",
  "scope": "project",
  "confidence": 0.88,
  "evidence": [],
  "createdAt": "...",
  "lastValidatedAt": "...",
  "content": "..."
}
```

---

# 18. Research engine

Research becomes first-class.

Sources:

```text
web
GitHub
documentation
repository
local filesystem
package registries
existing implementations
architecture references
```

Structured output:

```json
{
  "question": "...",
  "findings": [],
  "sources": [],
  "recommendation": "...",
  "confidence": 0.91
}
```

Research artifacts can be persisted into project memory.

---

# 19. QA Engine

QA becomes a subsystem rather than only an agent.

```text
QA Engine
├── unit
├── integration
├── API
├── E2E
├── browser
├── mobile
├── visual
├── accessibility
├── performance
├── security
└── regression
```

The QA planner determines which layers are required.

---

# 20. Playwright

Playwright becomes the primary browser automation backend.

Capabilities:

```text
navigate
click
fill
upload
download
assert
screenshot
trace
network capture
console capture
accessibility inspection
```

Failures must produce evidence:

```text
evidence/
  test-id/
    screenshot.png
    trace.zip
    console.json
    network.json
    result.json
```

---

# 21. Mobile QA

Provider abstraction:

```text
DeviceProvider
├── AndroidEmulator
├── IOSSimulator
└── ExternalDeviceProvider
```

Do not hardcode a single device implementation.

---

# 22. Visual QA

Use multiple signals:

```text
DOM assertions
+
accessibility
+
pixel/visual diff
+
LLM vision
```

Do not rely solely on an LLM visual judgment.

---

# 23. Requirement → verification graph

Create explicit traceability:

```text
Requirement
    ↓
Acceptance Criterion
    ↓
Test Case
    ↓
Execution
    ↓
Evidence
    ↓
Verification
```

The CEO should be able to report:

```text
Requirements: 37
Verified: 34
Unverified: 2
Failed: 1
```

---

# 24. Risk Engine

Expand the current risk router.

Risk dimensions:

```text
security
correctness
architecture
data
performance
product
UX
operational
regression
```

Risk determines:

```text
model
review depth
QA depth
research depth
human gate
retry budget
```

---

# 25. Evidence engine

Important claims should have evidence.

Evidence types:

```text
command result
test result
screenshot
trace
HTTP response
database verification
git diff
static analysis
research source
benchmark
agent observation
```

Evidence metadata:

```text
type
source
timestamp
task
confidence
hash
```

---

# 26. Review Engine

Retain risk-routed review.

Current concept:

```text
HIGH → four-layer review
LOW → two-layer review
```

v2:

```text
risk score
 ↓
review policy
 ↓
reviewers
 ↓
evidence verification
 ↓
verdict
```

Reviewers do not silently modify implementation.

---

# 27. Repair Engine

Do not blindly retry.

Differentiate:

```text
retry same strategy
retry with more context
retry with stronger model
change hypothesis
create research task
replan
escalate to human
```

Example:

```text
failure #1
  ↓
diagnose

failure #2
  ↓
change strategy

failure #3
  ↓
CEO intervention
```

---

# 28. Circuit breakers

Retain the current three-attempt principle but make it configurable.

```json
{
  "maxAttempts": 3,
  "maxSameStrategyAttempts": 1,
  "maxTotalCost": "...",
  "escalateAfter": 3
}
```

A retry must explain why it differs from the previous attempt.

---

# 29. Learning Engine

After every meaningful run:

```text
Outcome
 ↓
Analyze
 ↓
Identify causal factors
 ↓
Generate lesson
 ↓
Validate lesson
 ↓
Store candidate
 ↓
Evaluate against future runs
 ↓
Promote to policy
```

Example:

```text
Observed:
Frontend implementation failed repeatedly when API contracts
were not available.

Evidence:
7 runs
5 failures
3 projects

Candidate policy:
Generate API contract before frontend implementation.

Evaluation:
+18% first-pass success
-12% rework
```

The numerical improvement above is an illustrative example, not a benchmark result.

---

# 30. Self-improvement

Never allow uncontrolled self-modification.

Pipeline:

```text
Candidate Improvement
 ↓
Sandbox
 ↓
Benchmark
 ↓
Compare baseline
 ↓
Human/policy approval
 ↓
Promote
```

The system may learn policies.

It must not silently rewrite its own core.

---

# 31. Evaluation framework

Create benchmark suites:

```text
benchmarks/
├── planning/
├── coding/
├── debugging/
├── qa/
├── research/
├── context/
└── orchestration/
```

Metrics:

```text
task success
first-pass success
retries
tokens
cost
time
test coverage
requirement coverage
regressions
human interventions
wrong decisions
```

---

# 32. Harness self-evaluation

Compare harness versions:

```text
Harness v0.1
Harness v0.2
```

Measure:

```text
success rate
tokens/run
retries
human interventions
regressions
time
cost
```

Never claim an improvement without benchmark evidence.

---

# 33. MCP architecture

MCP is the interoperability boundary.

Expose high-level tools rather than every internal function.

Initial tools:

```text
flow_start
flow_status
flow_plan
flow_approve
flow_run
flow_pause
flow_resume
flow_cancel
flow_replan
flow_verify
flow_qa
flow_review
flow_report
flow_search_memory
flow_record_decision
```

Do not expose unrestricted internal mutations such as:

```text
flow_mutate_state_json
flow_write_arbitrary_memory
flow_promote_policy
```

without authorization.

---

# 34. MCP resources

Expose read-oriented state:

```text
flow://runs/{runId}
flow://runs/{runId}/plan
flow://runs/{runId}/tasks
flow://runs/{runId}/evidence
flow://runs/{runId}/metrics
flow://projects/{projectId}/architecture
flow://projects/{projectId}/memory
```

Resources should be cacheable where appropriate.

---

# 35. MCP prompts

Optional convenience prompts:

```text
start-development
review-project
investigate-failure
run-qa
analyze-architecture
summarize-run
```

Prompts are interfaces, not the core business logic.

---

# 36. MCP Tasks

Use MCP Tasks for long-running operations such as:

```text
start full development run
run complete QA suite
research architecture options
run mobile test matrix
execute benchmark
```

Return a task handle so the host does not need to keep an enormous conversational context alive.

---

# 37. MCP Apps

Later expose a dashboard:

```text
Run
├── objective
├── current phase
├── DAG
├── agents
├── QA
├── evidence
├── cost
└── decisions
```

This becomes the visual control center.

---

# 38. Local-first deployment

Initial target:

```text
local MCP server
        ↓
filesystem
Git
Playwright
emulators
local memory
```

Possible CLI:

```text
npx flow-dev-harness
```

Configuration:

```text
~/.flow-harness/
```

Project state:

```text
project/.flow/
```

---

# 39. Remote deployment

Later:

```text
MCP HTTPS server
       ↓
API gateway
       ↓
Harness workers
       ↓
memory/database
       ↓
LLM providers
       ↓
tool workers
```

Remote deployment requires authentication, authorization, tenancy isolation, rate limits, observability and explicit tool permissions.

---

# 40. Security model

Permissions:

```text
READ_REPOSITORY
WRITE_REPOSITORY
EXECUTE_COMMAND
NETWORK
BROWSER
EMULATOR
GIT_COMMIT
GIT_PUSH
DEPLOY
SECRETS
```

Example:

```text
QA:
  READ_REPOSITORY
  EXECUTE_TESTS
  BROWSER

Backend:
  READ_REPOSITORY
  WRITE_REPOSITORY
  EXECUTE_TESTS

Research:
  READ_REPOSITORY
  NETWORK
```

Dangerous capabilities require policy and/or human approval.

---

# 41. Prompt injection defense

Repository and web content remain untrusted data.

Sources considered untrusted:

```text
README
source comments
HTML
web pages
issues
PRs
dependencies
test fixtures
generated files
browser content
```

The harness must distinguish:

```text
DATA
vs
CONTROL
```

Prompt-injection findings should be recorded as security findings.

---

# 42. Human gates

Retain human gates but make them policy-driven.

Possible gates:

```text
plan approval
high-risk execution
external side effect
production deployment
policy promotion
self-improvement
secret access
destructive operation
final merge
```

Trivial work should not require unnecessary human intervention.

---

# 43. Git/worktree engine

Abstract Git:

```text
GitProvider
├── status
├── diff
├── branch
├── worktree
├── commit
├── merge
└── push
```

Retain isolated worktrees for agent execution.

---

# 44. State persistence

Support:

```text
filesystem
SQLite
PostgreSQL
```

Initial implementation:

```text
SQLite
+
event log
```

Remote deployment can use PostgreSQL.

---

# 45. Memory storage

Initial implementation:

```text
SQLite
```

Add vector retrieval only after benchmarks demonstrate measurable value.

Do not add a vector database simply because the system has memory.

---

# 46. Observability

Use OpenTelemetry.

Track:

```text
run
task
agent
LLM invocation
tool invocation
QA execution
verification
review
```

Metrics:

```text
latency
tokens
cost
success
failure
retry
model
tool
```

Keep logs outside model context unless specifically retrieved.

---

# 47. Cost accounting

Provider-aware accounting:

```text
input tokens
output tokens
cached tokens
reasoning tokens when available
estimated cost
actual cost when available
model
provider
task
phase
```

Never fabricate unavailable billing information.

---

# 48. Migration strategy

Do not rewrite everything at once.

Create:

```text
harness-v2
```

from the current `master` baseline.

## Phase 0 — Architecture

Freeze current behavior.

Write architecture decisions and compatibility goals.

## Phase 1 — Core runtime

Implement:

```text
Run
Task
DAG
State
Events
Scheduler
Circuit breaker
```

Acceptance:

- deterministic DAG
- resume after process restart
- event replay
- no LLM required for state transitions

## Phase 2 — Provider abstraction

Implement:

```text
LLMProvider
ModelRouter
ModelProfile
```

Start with one provider, then add at least one independent provider.

## Phase 3 — CEO

Implement executive loop.

Acceptance:

- create tasks
- delegate
- observe results
- replan
- stop
- request human intervention

## Phase 4 — Context engine

Implement:

```text
project indexing
facts
decisions
context retrieval
token budgeting
```

Benchmark against cold-repository baseline.

## Phase 5 — Memory

Implement:

```text
working memory
project memory
episodic memory
lessons
```

No vector database initially.

## Phase 6 — Research

Implement structured research artifacts.

## Phase 7 — Agent fleet

Implement role contracts and worktrees.

Port:

```text
backend
frontend
data
security
performance
QA
docs
```

## Phase 8 — QA engine

Implement:

```text
unit
integration
API
Playwright
```

## Phase 9 — Browser evidence

Implement:

```text
screenshots
traces
network
console
visual comparison
```

## Phase 10 — Mobile

Add:

```text
Android emulator
iOS simulator
```

through provider interfaces.

## Phase 11 — Risk/review engine

Port and extend current risk routing.

## Phase 12 — Repair

Implement controlled failure diagnosis and replanning.

## Phase 13 — Evaluation

Create benchmark suite and baseline measurements.

## Phase 14 — Learning

Implement lesson extraction, candidate policies, validation and promotion.

## Phase 15 — MCP

Expose:

```text
tools
resources
prompts
Tasks
```

The core must remain usable without MCP.

## Phase 16 — MCP Apps

Build dashboard.

## Phase 17 — Remote deployment

Add:

```text
HTTPS MCP
authentication
authorization
PostgreSQL
worker pool
observability
```

---

# 49. Compatibility mode

Keep the existing Claude Code skill as a thin adapter.

Target:

```text
Claude Skill
     │
     ▼
MCP / CLI adapter
     │
     ▼
Harness Core
```

The skill becomes an entry point rather than the implementation.

---

# 50. Migration from flow.sh

Do not immediately delete `flow.sh`.

Port functionality:

```text
flow.sh init       → RunService
flow.sh add        → TaskService
flow.sh waves      → Scheduler
flow.sh set        → State/Event service
flow.sh ready      → Scheduler
flow.sh gate       → Policy/Gate service
flow.sh budget     → CostLedger
flow.sh panel      → Status renderer
flow.sh report     → Metrics reporter
```

Maintain compatibility until parity is demonstrated.

---

# 51. Preserve current strengths

The following concepts should survive v2:

- progressive disclosure
- risk-routed review
- self-contained plans
- verification gates
- isolated worktrees
- circuit breakers
- batching
- stable prompt prefixes
- deterministic orchestration
- compact agent returns
- token ledger
- explicit human gates
- evidence-based findings

---

# 52. Replace current limitations

Replace:

```text
Claude-specific orchestration
```

with:

```text
provider abstraction
```

Replace:

```text
state.json as primary state
```

with:

```text
event log + state projection
```

Replace:

```text
static plans
```

with:

```text
dynamic task graph
```

Replace:

```text
QA agent
```

with:

```text
QA Engine
```

Replace:

```text
conversation context
```

with:

```text
persistent context engine
```

Replace:

```text
manual learning
```

with:

```text
evaluation + learning pipeline
```

Replace:

```text
skill as orchestrator
```

with:

```text
runtime as orchestrator
```

---

# 53. Definition of success

The harness is successful when a user can connect it to an MCP-compatible host and say:

```text
Build this application.
```

The system should be able to:

1. understand the objective
2. research unknowns
3. establish requirements
4. build architecture
5. create a DAG
6. choose models
7. execute tasks
8. run tests
9. operate browsers
10. inspect evidence
11. detect failures
12. repair/replan
13. review changes
14. maintain project memory
15. produce a final report
16. record lessons
17. resume later
18. switch LLM provider without losing context

---

# 54. Ultimate architecture

```text
                 ┌─────────────────────────┐
                 │          HUMAN          │
                 └────────────┬────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │       CEO        │
                    │  Executive AI    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
          Context         Research        Strategy
          Engine           Engine          Engine
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                       Dynamic DAG
                             │
                         Scheduler
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
           Agents          Agents          Agents
             │               │               │
             └───────────────┼───────────────┘
                             ▼
                          QA Engine
                             │
                    ┌────────┼────────┐
                    ▼        ▼        ▼
                 Browser    API     Mobile
                    │        │        │
                    └────────┼────────┘
                             ▼
                          Evidence
                             │
                             ▼
                         Reviewer
                             │
                         Evaluator
                             │
                         Learner
                             │
                             ▼
                         Memory
                             │
                             └────────► CEO
```

Underlying infrastructure:

```text
             ┌────────────────────────┐
             │       MODEL ROUTER      │
             │ Claude / GPT / Gemini  │
             │ Local / Other          │
             └────────────────────────┘

             ┌────────────────────────┐
             │       EVENT STORE      │
             └────────────────────────┘

             ┌────────────────────────┐
             │    COST / TELEMETRY    │
             └────────────────────────┘

             ┌────────────────────────┐
             │       MCP SERVER       │
             └────────────────────────┘
```

---

# 55. Final product definition

`flow-dev-company` v2 should not be treated as an AI coding agent.

It should be:

> **An LLM-agnostic software engineering operating system that gives AI agents persistent memory, executive reasoning, deterministic orchestration, autonomous verification, browser/mobile QA, evidence, and controlled self-improvement.**

MCP is the universal interface through which different AI hosts can operate that system.

The core remains independent from MCP so it can also run through a CLI, local daemon, CI pipeline or future service API.

---

# 56. Immediate next implementation step

1. Create branch `harness-v2` from `master` at `d4c96f2`.
2. Add this plan as `PLAN.md`.
3. Add architecture decision records for:
   - provider abstraction
   - event-sourced state
   - MCP boundary
   - local-first deployment
   - memory architecture
4. Establish the TypeScript/pnpm verification baseline.
5. Implement Phase 1 only.
6. Do not begin CEO, QA, MCP or learning work until the runtime has deterministic state, event replay and resumability.

The first milestone is therefore not "build an autonomous AI company".

It is:

> **Build a deterministic, resumable runtime that can safely host one.**
