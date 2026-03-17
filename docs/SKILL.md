# pastoon — Coding Agent Workflow Guide

pastoon exposes MCP tools for converting between JSON and TOON format. Use these tools to reduce token usage when working with JSON data in your reasoning context.

## When to use `json-to-toon`

Call `pastoon json-to-toon` (or the `json_to_toon` MCP tool) **before** including large JSON data in your reasoning context:

- JSON responses from API calls (more than ~10 lines)
- JSON fixtures or test data you need to reason over
- JSON config files you're analyzing
- Any JSON structure you'll reference multiple times in a session

```bash
pastoon json-to-toon '{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}'
```

**Result:** TOON is ~40% fewer tokens than the same JSON, with no information loss.

## When to use `toon-to-json`

Call `pastoon toon-to-json` (or the `toon_to_json` MCP tool) when you need to:

- Modify TOON data and write valid JSON back to a file
- Pass JSON to an API that requires it
- Convert TOON output back to a format another tool expects

```bash
pastoon toon-to-json 'users[2]{id,name}:
1,Alice
2,Bob'
```

## When NOT to convert

- **Tiny JSON** (`{"ok": true}`, `{"count": 5}`) — overhead isn't worth it
- **JSON being written to a file** — write the original JSON, not TOON
- **JSON you won't reason over** — if you're just passing it through, skip conversion

## MCP tools

When configured as an MCP server (`pastoon mcp add`), pastoon exposes:

| Tool | Description |
|------|-------------|
| `json-to-toon` | Convert a JSON string to TOON (40% fewer tokens) |
| `toon-to-json` | Convert a TOON string back to JSON |

## CLI reference

```bash
pastoon                  # JSON → TOON (clipboard one-shot)
pastoon --reverse        # TOON → JSON (clipboard one-shot)
pastoon --pipe           # stdin → stdout (for scripts)
pastoon json-to-toon '…' # convert JSON string directly
pastoon toon-to-json '…' # convert TOON string directly
pastoon setup            # install menu bar tray + LaunchAgent
```
