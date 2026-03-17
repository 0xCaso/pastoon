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

## Agent install

If you use a coding agent (Claude Code, OpenCode, Cursor, Windsurf), give it [SETUP.md](./docs/SETUP.md):

> "Set up pastoon for me using the instructions in docs/SETUP.md"

## MCP server

pastoon exposes two MCP tools for agents working with JSON in context:

```bash
pastoon mcp add   # register with detected coding agents
pastoon --mcp     # start MCP server manually
```

**Tools:**
- `json-to-toon` — convert JSON string to TOON (use before reasoning over large JSON)
- `toon-to-json` — convert TOON string back to JSON

## CLI

```bash
pastoon            # JSON → TOON (clipboard)
pastoon --reverse  # TOON → JSON (clipboard)
pastoon --pipe     # stdin → stdout (for scripts)

pastoon setup      # install LaunchAgent + start tray
pastoon stop       # pause tray
pastoon start      # resume tray
pastoon uninstall  # full removal
```

## What is TOON?

[TOON (Token-Oriented Object Notation)](https://github.com/toon-format/toon) is a compact, human-readable format for JSON data. It achieves:
- ~40% fewer tokens than JSON
- 76.4% LLM accuracy vs JSON's 75.0%
- Perfect lossless round-trip
- Spec-driven with implementations in TypeScript, Python, Go, Rust

## License

MIT
