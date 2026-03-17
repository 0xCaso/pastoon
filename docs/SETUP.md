# pastoon Setup

> Give this file to your coding agent and say: "Set up pastoon for me."
>
> Agent: read this top to bottom, execute each tier that applies.

## Tier 1 — Clipboard auto-conversion (the main feature)

Install pastoon globally and set it up to auto-convert JSON in your clipboard to TOON format (40% fewer LLM tokens) on every copy. Runs in the menu bar.

```bash
npm install -g pastoon
pastoon setup
```

That's it. From now on, every time you copy JSON, pastoon silently converts it to TOON before you paste.

To pause: click `[P]` in the menu bar → uncheck "Auto-convert JSON".
To resume: re-check it.

---

## Tier 2 — MCP server for coding agents

Register pastoon as an MCP server so your coding agents (Claude Code, OpenCode, Cursor, etc.) can call `json_to_toon` and `toon_to_json` directly in-context.

```bash
pastoon mcp add
```

This auto-detects your installed agents and writes the MCP config for each.

**Available MCP tools:**
- `json-to-toon` — convert a JSON string to TOON (40% fewer tokens)
- `toon-to-json` — convert a TOON string back to JSON

---

## Tier 3 — Manual CLI usage

One-shot convert (clipboard):
```bash
pastoon          # JSON → TOON
pastoon --reverse  # TOON → JSON
```

Pipe mode (stdin → stdout):
```bash
echo '{"name":"Alice"}' | pastoon --pipe
curl https://api.example.com/data | pastoon --pipe | llm "summarize this"
cat data.json | pastoon --pipe > data.toon
```

---

## Tier 4 — Uninstall / pause

Stop the tray (keeps LaunchAgent, restarts on next login):
```bash
pastoon stop
```

Start again:
```bash
pastoon start
```

Full removal (removes LaunchAgent, config, and tray):
```bash
pastoon uninstall
npm uninstall -g pastoon
```
