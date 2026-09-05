# flow-harness

**[English](README.md) · [Español](README.es.md)**

Un **harness de ingeniería de software agnóstico al LLM**: un runtime determinista y resumible que
planifica, ejecuta, verifica y revisa trabajo de software — con el LLM como motor de razonamiento
intercambiable, no como el sistema.

El runtime posee la orquestación, el estado, el scheduling, la memoria, el coste y la seguridad. El
modelo decide *qué* debe pasar; el runtime decide *cómo* pasa, de forma reproducible. El juicio
corre en un modelo fuerte, la ejecución en uno barato — configurable por tier.

> Estado: un **alpha del motor**, construido de abajo hacia arriba y totalmente testeado. Corre
> bucles autónomos reales bajo gates humanos y ha escrito varios de sus propios paquetes — pero
> todavía no es un producto llave en mano para repos arbitrarios. Los cimientos son sólidos; cada
> capacidad que falta es un paquete bien definido sobre la misma columna. Ver [`STATUS.md`](STATUS.md).

## Qué funciona hoy

- **Bucle autónomo, de punta a punta** — un CEO decide la siguiente jugada, un executor escribe/edita
  código y lo verifica, el runtime avanza las waves, todo bajo gates humanos. Probado con
  inferencia real.
- **Cualquier inferencia, por rol** — cada tier (`haiku`/`sonnet`/`opus`) mapea a su propio
  provider/modelo vía env: p. ej. el CEO en Anthropic o Gemini, la ejecución en Groq. Los providers
  son cero-dependencias (OpenAI-compatible + Anthropic Messages API) sobre el `fetch` global. Un tier
  puede declarar un **fallback** automático (p. ej. OpenRouter) al que el router cambia cuando el
  primario se satura — capacidad de desahogo para runs con mucha paralelización, con retry/backoff debajo.
- **Edita código real** — un editor search/replace seguro (el texto buscado debe coincidir
  exactamente una vez, rutas confinadas al directorio destino), no solo ficheros nuevos completos.
- **Un cerebro que usa sus piezas** — el CEO decide con **lecciones** recuperadas (memoria) y
  **contexto** del repo; un **motor de riesgo** manda los cambios de alto riesgo a revisión humana.
- **Aprende** — cada run graba una lección; runs posteriores la recuerdan.
- **Dos interfaces** — una CLI `flow` (drop-in del `flow.sh` original) y un **servidor MCP**
  (herramientas `flow_*`, incluida `flow_execute`, `flow_spec`/`flow_converge`, y `flow_qa` — planificar,
  verificar con evidencia, y medir convergencia por MCP), para que cualquier host MCP lo maneje.
- **Se construye a sí mismo** — paquetes como `@flow/memory` y `@flow/review` fueron escritos por el
  harness corriendo sobre su propio repositorio, bajo revisión humana.
- **Todo corre en Docker.** 154 tests. El núcleo es determinista — sin LLM.

## La idea única

**El control determinista vive en código; el juicio vive en el LLM.** El estado es una proyección
event-sourced que puedes borrar y reconstruir; el scheduling y el circuit breaker son aritmética; al
LLM se le llama solo donde hace falta juicio.

Ver [`ARCHITECTURE.md`](ARCHITECTURE.md) para el mapa conceptual (con diagramas),
[`STATUS.md`](STATUS.md) para el seguimiento de hitos, y [`docs/decisions`](docs/decisions) para los
registros de decisiones de arquitectura (ADRs).

## Paquetes

| Paquete | Rol |
|---|---|
| `@flow/core` | Runtime event-sourced: log, proyección, scheduler de waves (Kahn), circuit breaker, ledger, gates |
| `@flow/cli` | El comando `flow` (drop-in de `flow.sh`) |
| `@flow/mcp-server` | Servidor MCP: herramientas `flow_*`, incl. `flow_execute` |
| `@flow/llm` | Inferencia provider-neutral; routing por tier; OpenAI-compatible + Anthropic |
| `@flow/context` | Índice determinista del repo + ranking de relevancia + contexto con presupuesto de tokens |
| `@flow/ceo` | El bucle ejecutivo — decide la siguiente jugada (con memoria + contexto) |
| `@flow/executor` | Escribe y **edita** código, luego corre el verify (el único que escribe código de producto) |
| `@flow/orchestrator` | El conductor: CEO → executor → runtime, con gate de riesgo y registro de lecciones (`flow-run`) |
| `@flow/memory` | Store de lecciones append-only + búsqueda por relevancia |
| `@flow/review` | Motor determinista de riesgo/revisión |
| `@flow/planner` | Planner Spec-Driven Development: objetivo → spec → DAG ordenado de tareas con verify por tarea |
| `@flow/converge` | Reporte de convergencia done-vs-spec (green/pending, completo, clarificaciones abiertas) |
| `@flow/git` | Worktree de git por run + gate de PR — aísla el run en su propia rama, working tree intacto |
| `@flow/qa` | Motor de QA determinista (Capa A): verificación por criterio + evidencia + tickets de error; lib standalone + bin `flow-qa` |

## Inicio rápido (Docker)

```bash
docker compose build
docker compose run --rm test        # build + suite completa

docker compose run --rm flow init demo "build a small API"
docker compose run --rm flow add api backend sonnet
docker compose run --rm flow waves
docker compose run --rm flow panel
```

### Configurar los LLMs por tier

Cada tier puede usar un provider/modelo distinto. Ejemplo — CEO en un modelo fuerte, ejecución en
uno barato/rápido:

```bash
# tier del CEO (opus) — p. ej. Gemini vía su endpoint OpenAI-compatible, o Anthropic
FLOW_LLM_OPUS_PROVIDER=openai
FLOW_LLM_OPUS_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
FLOW_LLM_OPUS_API_KEY=...        FLOW_LLM_OPUS_MODEL=gemini-2.5-pro
#   (Anthropic en su lugar: FLOW_LLM_OPUS_PROVIDER=anthropic  FLOW_LLM_OPUS_API_KEY=...  FLOW_LLM_OPUS_MODEL=claude-opus-5)

# tiers de ejecución (sonnet/haiku) — p. ej. Groq
FLOW_LLM_SONNET_PROVIDER=openai
FLOW_LLM_SONNET_BASE_URL=https://api.groq.com/openai/v1
FLOW_LLM_SONNET_API_KEY=...      FLOW_LLM_SONNET_MODEL=openai/gpt-oss-120b

# fallback opcional por tier — desahogo cuando el primario se satura (OpenRouter mostrado;
# OpenAI-compatible, sus modelos :free son lentos pero un buen par de manos extra)
FLOW_LLM_SONNET_FALLBACK_PROVIDER=openai
FLOW_LLM_SONNET_FALLBACK_BASE_URL=https://openrouter.ai/api/v1
FLOW_LLM_SONNET_FALLBACK_API_KEY=sk-or-v1-...   FLOW_LLM_SONNET_FALLBACK_MODEL=deepseek/deepseek-chat-v3-0324:free
```

Sin configuración, usa por defecto un provider fake determinista y offline, así que los tests y las
pruebas en seco no necesitan API key. Las claves viven en un `.env` gitignoreado (copia
[`.env.example`](.env.example)); `docker compose` lo carga automáticamente. Un run autónomo es un
config JSON manejado por `flow-run` (ver [`examples/run.example.json`](examples/run.example.json)).

## Cómo se construyó

El harness se construyó con el skill de orquestación `flow-dev-company` (un "cerebro" caro planifica
y revisa, agentes baratos ejecutan de forma aislada) — y, cada vez más, **por sí mismo**: features
recientes las escribió `flow-run` manejando el harness contra su propio repositorio, con un humano
aprobando el plan y revisando cada diff.
