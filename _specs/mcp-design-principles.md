# MCP Design Principles

Standards for how MCP tools in this codebase respond. **Every tool added or modified must follow these.** Future agents — read this before planning new MCP features or fixing tool bugs.

This is a living doc. Add principles here as they emerge from real failures.

---

## 1. Closed-loop steering — never leave the LLM with nothing

**Principle:** A bare empty array, null, or generic error message gives the LLM nothing to work with. It will fall back to its training data and hallucinate. Every tool response must keep the LLM driven by the tool output, even when there's no data to return.

### Required response envelope

Every tool response is an object with:

| Field | When | Purpose |
|---|---|---|
| `status` | always | Discriminator the LLM (and downstream code) can branch on — e.g. `ok`, `no_upcoming_seasons`, `missing_context`, `ambiguous`, `not_found` |
| Payload field | always | The actual data, named for the entity (`seasons`, `fetes`, `trip`, etc.). May be `[]` or `null` — that's fine, it's the envelope that matters. |
| `message` | when user-facing context matters | Human-readable explanation the LLM can surface to the user |
| `guidance` | on every non-ok status | Explicit instructions for the LLM, **including don'ts** ("do NOT invent dates", "do NOT call X tool"). LLMs treat tool-output instructions roughly like system prompts. |

### Anti-pattern

```json
[]
```

The LLM sees this and thinks "no information available, I'll fill in what I know." It then hallucinates.

### Pattern

```json
{
  "status": "no_upcoming_seasons",
  "seasons": [],
  "message": "No upcoming carnival seasons are currently configured. Trinidad Carnival 2026 (Feb 16-17) has already taken place; 2027 has not yet been seeded.",
  "guidance": "Tell the user that planning is not yet available and data will be added closer to the next event. Do NOT invent carnival dates or season ids. Do NOT fall back to general knowledge about Trinidad Carnival schedules — only data returned by this tool is authoritative."
}
```

### Where this applies

- **Empty results** — no rows match the filter
- **Not found** — single-item lookup returns no row
- **Missing required context** — server-gated fields aren't set (e.g. `missing_context` response)
- **Ambiguous results** — multiple candidates tie for top spot
- **Errors** — DB failures, validation errors. Even error messages should steer ("try X", "ask the user for Y")

### Why we have this rule

Observed 2026-06-09 in production. `get_carnival_seasons` correctly returned an empty array (no future seasons configured), and Claude Desktop hallucinated season data from training rather than surfacing the empty state to the user. Fixed in PR #12.

### How to apply

Before merging any MCP tool change, walk every code path and ask:
- "If the underlying query returns nothing, what JSON does the LLM see?"
- "If validation fails, what does the LLM see?"
- "If a required precondition is missing, what does the LLM see?"

If any of those is "an empty array" or "a generic error string", the response is incomplete. Add the envelope.

---

## 2. Tool descriptions are part of the steering surface

Tool descriptions get inlined into the LLM's prompt at every conversation turn. Use them to instruct the LLM on:

- What to gather **before** calling the tool (e.g. `create_trip`'s description: "gather these 4 fields conversationally first")
- What response states to expect and how to branch on each
- What other tools to call as follow-ups (e.g. "if status is `no_active_trip`, call `create_trip`")

Treat the description as load-bearing prompt engineering, not as documentation.

See `src/mcp/tools/trips.ts` for examples.

---

## 3. Authoritative-data principle

**Principle:** Tool responses are the authoritative source for the LLM's reasoning. Do not let it fall back to general knowledge to fill gaps.

Practical implication: when a tool can't provide data, the `guidance` field should explicitly say "do NOT fall back to general knowledge about X". The LLM's training data contains information about Trinidad Carnival, hotels in Port of Spain, fete schedules, etc. — all potentially stale and unverified. Steering away from it is part of every empty-state response.
