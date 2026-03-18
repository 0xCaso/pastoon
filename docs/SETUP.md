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

Tray menu options:
- **Auto-convert JSON** — toggle auto-conversion on/off
- **Convert clipboard now** — manually trigger one conversion
- **Undo (restore JSON)** — restore the last original JSON
- **Reverse (TOON → JSON)** — convert TOON in clipboard back to JSON
- **Quit** — stop pastoon

---

## Tier 2 — Agent integration

pastoon is built with [incur](https://github.com/wevm/incur), which exposes every command as both a CLI tool and an MCP tool automatically.

**Skills (recommended):** register pastoon commands as on-demand skills — lower token cost, TOON output natively.

```bash
pastoon skills add
```

**MCP (fallback):** for agents that only support MCP, pastoon also works as an MCP server with no extra setup.

```bash
pastoon mcp add
```

This auto-detects your installed agents and writes the MCP config for each.

**Available tools (both interfaces):**
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
echo 'users[2]{id,name}:\n1,Alice\n2,Bob' | pastoon --pipe --reverse
```

---

## Tier 4 — Uninstall / pause

Stop the tray (keeps background service, restarts on next login):
```bash
pastoon stop
```

Start again:
```bash
pastoon start
```

Full removal (removes background service, config, and tray):
```bash
pastoon uninstall
npm uninstall -g pastoon
```
