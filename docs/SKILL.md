# pastoon — Coding Agent Workflow Guide

pastoon is built with [incur](https://github.com/wevm/incur) — every command is available as both a CLI tool and an MCP tool automatically. Use these commands to reduce token usage when working with JSON data in your reasoning context.

## When to use `json-to-toon`

Call `pastoon json-to-toon` **before** including large JSON data in your reasoning context:

- JSON responses from API calls (more than ~10 lines)
- JSON fixtures or test data you need to reason over
- JSON config files you're analyzing
- Any JSON structure you'll reference multiple times in a session

```bash
pastoon json-to-toon '{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}'
```

**Result:** TOON is ~40% fewer tokens than the same JSON, with no information loss.

## When to use `toon-to-json`

Call `pastoon toon-to-json` when you need to:

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

## Available tools

| Command | Description |
|---------|-------------|
| `json-to-toon` | Convert a JSON string to TOON (~40% fewer tokens). Accepts `--delimiter` (`,` `\t` `\|`) and `--keyFolding` (`off` `safe`). |
| `toon-to-json` | Convert a TOON string back to JSON |

These commands are exposed automatically as MCP tools via incur (`pastoon mcp add`).

## CLI reference

```bash
pastoon                       # JSON → TOON (clipboard one-shot)
pastoon --reverse             # TOON → JSON (clipboard one-shot)
pastoon --pipe                # stdin → stdout
pastoon --pipe --reverse      # TOON stdin → JSON stdout
pastoon json-to-toon '…'     # convert JSON string directly
pastoon toon-to-json '…'     # convert TOON string directly
pastoon setup                 # install background service + start tray
pastoon skills add            # register as on-demand agent skills (recommended)
pastoon mcp add               # register as MCP server (fallback)
```
