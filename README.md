# pastoon

> Auto-convert clipboard JSON to TOON — 40% fewer LLM tokens, zero friction.

## What it does

Every time you copy JSON, pastoon silently converts it to [TOON format](https://github.com/toon-format/toon) before you paste — saving ~40% of tokens in LLM chat UIs, coding agents, and API calls.

```
JSON (verbose):                    TOON (40% fewer tokens):
{                                  users[3]{id,name,role}:
  "users": [                         1,Alice,admin
    {"id":1,"name":"Alice",          2,Bob,user
     "role":"admin"},                3,Carol,user
    ...
  ]
}
```

TOON is lossless — perfect JSON round-trip, same data model, just without the braces, quotes, and repeated keys.

## Install

```bash
npm install -g pastoon
pastoon setup
```

That's it. The `[P]` icon appears in your menu bar. Every JSON you copy is automatically converted.

Supports macOS (LaunchAgent), Linux (systemd user service), and Windows (registry Run key).

## Agent integration

pastoon is built with [incur](https://github.com/wevm/incur) — a CLI framework that makes every command available as both a CLI tool and an MCP tool automatically.

**Skills (recommended):** agents discover and load pastoon commands on-demand, with TOON output natively.

```bash
pastoon skills add   # register with your coding agent (Claude Code, OpenCode, etc.)
```

**MCP (fallback):** for agents that only support MCP, pastoon also works as an MCP server — no extra code needed, incur provides it automatically.

```bash
pastoon mcp add   # register as MCP server with detected coding agents
pastoon --mcp     # start MCP server manually
```

**Available tools (both interfaces):**
- `json-to-toon` — convert JSON string to TOON (use before reasoning over large JSON)
- `toon-to-json` — convert TOON string back to JSON

Or give your agent [SETUP.md](./docs/SETUP.md) and say: "Set up pastoon for me."

## CLI

```bash
pastoon            # JSON → TOON (clipboard)
pastoon --reverse  # TOON → JSON (clipboard)
pastoon --pipe     # stdin → stdout (for scripts)
pastoon --pipe --reverse  # TOON stdin → JSON stdout

pastoon json-to-toon '<json>'   # convert JSON string directly
pastoon toon-to-json '<toon>'   # convert TOON string directly

pastoon setup      # install background service + start tray
pastoon stop       # stop tray
pastoon start      # start tray
pastoon uninstall  # full removal
```

`json-to-toon` also accepts `--delimiter` (`,` `\t` `|`) and `--keyFolding` (`off` `safe`).

## What is TOON?

[TOON (Token-Oriented Object Notation)](https://github.com/toon-format/toon) is a compact, human-readable format for JSON data. It achieves:
- ~40% fewer tokens than JSON
- 76.4% LLM accuracy vs JSON's 75.0%
- Perfect lossless round-trip
- Spec-driven with implementations in TypeScript, Python, Go, Rust

## License

MIT
