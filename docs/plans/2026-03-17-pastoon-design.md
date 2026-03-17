# pastoon — Design Spec

**Date**: 2026-03-17  
**Status**: Approved for implementation  
**npm package**: `pastoon`  
**CLI command**: `pastoon`  
**GitHub**: `pastoon/pastoon`

---

## 1. Problem

LLMs charge per token. JSON is the universal data format developers copy and paste into LLM interfaces, but it is verbose by design — braces, quotes, repeated keys. A 100-row dataset in JSON costs ~4,500 tokens. The same data in TOON costs ~2,700 tokens — a 40% reduction with zero information loss.

Developers paste JSON into:
- LLM chat UIs (Claude.ai, ChatGPT, Gemini)
- Coding agents (Claude Code, OpenCode, Cursor, Windsurf)
- LLM CLI tools
- API calls they build themselves

In every case, the JSON enters the LLM context verbatim. There is no interception layer. Developers either pay the token cost without thinking, or manually convert — which nobody does.

**pastoon** is that interception layer.

---

## 2. What is TOON

TOON (Token-Oriented Object Notation) is a compact, human-readable encoding of the JSON data model. It uses YAML-style indentation for objects and CSV-style tabular layout for uniform arrays.

```
JSON (verbose):                    TOON (40% fewer tokens):
{                                  users[3]{id,name,role}:
  "users": [                         1,Alice,admin
    {"id":1,"name":"Alice",          2,Bob,user
     "role":"admin"},                3,Carol,user
    {"id":2,"name":"Bob",
     "role":"user"},
    {"id":3,"name":"Carol",
     "role":"user"}
  ]
}
```

Key properties:
- Lossless: perfect JSON round-trip
- Same data model as JSON (objects, arrays, primitives)
- Spec-driven with stable TypeScript, Python, Go, Rust implementations
- 76.4% LLM accuracy vs JSON's 75.0%, while using ~40% fewer tokens
- Official npm library: `@toon-format/toon`
- Official CLI: `@toon-format/cli`

---

## 3. Solution

`pastoon` is a single npm package that auto-converts JSON in your clipboard to TOON before you paste it into an LLM. Setup once, works forever.

It has four interfaces designed for different workflows:

| Interface | Use case |
|-----------|----------|
| Menu bar tray | Always-on auto-conversion, toggle on/off |
| CLI one-shot | Manual trigger, scriptable |
| MCP server | Agent-to-agent programmatic conversion |
| SETUP.md | "Give this to your agent" install guide |

---

## 4. Architecture

```
pastoon (npm package)
│
├── src/
│   ├── core.ts          -- JSON detection + TOON conversion
│   ├── cli.ts           -- CLI entry point
│   ├── tray.ts          -- Menu bar app (systray2)
│   ├── mcp.ts           -- MCP server
│   ├── launchagent.ts   -- macOS LaunchAgent install/uninstall
│   └── config.ts        -- Config file read/write
│
├── docs/
│   ├── SETUP.md         -- "Give to your agent" install guide
│   └── SKILL.md         -- Workflow instructions for coding agents
│
└── package.json
```

### Dependencies

| Package | Role |
|---------|------|
| `@toon-format/toon` | Official TOON encoder/decoder. Not reimplemented. |
| `clipboardy` | Cross-platform clipboard read/write |
| `systray2` | Native tray icon (mac/linux/win), no Electron |
| `@modelcontextprotocol/sdk` | MCP server implementation |

---

## 5. CLI Interface

```bash
# Install
npm install -g pastoon

# One-shot: convert clipboard JSON → TOON in place
pastoon

# One-shot reverse: convert clipboard TOON → JSON
pastoon --reverse

# Pipe mode: stdin → stdout (for scripting)
# Note: --reverse --pipe combination is not supported in v1
echo '{"name":"Ada"}' | pastoon --pipe
cat data.json | pastoon --pipe > data.toon

# Setup: installs LaunchAgent + starts menu bar tray
pastoon setup

# Setup with MCP: also configures detected coding agents
pastoon setup --mcp

# Service control (does not remove LaunchAgent)
pastoon stop
pastoon start

# Teardown
pastoon uninstall
```

---

## 6. Menu Bar Tray

When `pastoon setup` runs, it installs a macOS LaunchAgent and starts a
persistent background process (`pastoon --tray`) that:

1. Runs a clipboard watcher (polls at ~300ms)
2. Shows a menu bar icon (`[P]` or a small TOON-derived icon)
3. On every clipboard change, attempts `JSON.parse()` on the content
4. If valid JSON → encodes to TOON via `@toon-format/toon` → writes back to clipboard
5. Fires a macOS notification: `"pastoon: converted JSON → TOON"`

### Menu items

```
[P]
 ├─ ✓ Auto-convert JSON       ← toggle (checkmark = active)
 ├─ ──────────────
 ├─ Convert clipboard now     ← manual one-shot trigger
 ├─ Undo (restore JSON)       ← restores last original JSON (single-level; cleared on next copy)
 ├─ Reverse (TOON → JSON)     ← manual one-shot reverse
 ├─ ──────────────
 └─ Quit
```

### Persistence across reboots

`pastoon setup` writes:

```
~/Library/LaunchAgents/com.pastoon.plist
```

This file uses `RunAtLoad=true` and `KeepAlive=true`. macOS automatically
starts the process on every login. If it crashes, macOS restarts it.
The user never needs to open a terminal.

### LaunchAgent plist (generated)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.pastoon</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/pastoon</string>
    <string>--tray</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/pastoon.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/pastoon.error.log</string>
</dict>
</plist>
```

---

## 7. MCP Server

`pastoon mcp` starts an MCP server over stdio transport.

Any MCP-compatible client (Claude Code, OpenCode, Cursor, Windsurf, etc.)
can be configured to use it.

### Tools exposed

**`json_to_toon`**
```typescript
{
  name: "json_to_toon",
  description: "Convert a JSON string to TOON format (40% fewer tokens). Use this before including large JSON data in your reasoning context.",
  inputSchema: {
    json: string,                  // JSON string to convert
    delimiter?: "," | "\t" | "|",  // default: ","
    keyFolding?: "off" | "safe"    // default: "off"
  },
  returns: string  // TOON-encoded string
}
```

**`toon_to_json`**
```typescript
{
  name: "toon_to_json",
  description: "Convert a TOON string back to JSON.",
  inputSchema: {
    toon: string  // TOON string to decode
  },
  returns: string  // JSON string
}
```

**`clipboard_to_toon`**
```typescript
{
  name: "clipboard_to_toon",
  description: "Read the clipboard, convert JSON to TOON, write TOON back to clipboard.",
  inputSchema: {},
  returns: { converted: boolean, result: string }
}
```

### MCP config (auto-generated by `pastoon setup --mcp`)

**Claude Code** (`~/.claude.json`):
```json
{
  "mcpServers": {
    "pastoon": {
      "command": "pastoon",
      "args": ["mcp"]
    }
  }
}
```

**OpenCode** (`~/.config/opencode/config.json`):
```json
{
  "mcp": {
    "pastoon": {
      "type": "local",
      "command": ["pastoon", "mcp"]
    }
  }
}
```

The `pastoon setup --mcp` command detects which agents are installed by
checking for their config file paths and adds the entry automatically.

---

## 8. JSON Detection

```typescript
function isValidJson(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const t = text.trim();
  // Quick heuristic before full parse: must start with { or [
  if (t[0] !== '{' && t[0] !== '[') return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}
```

- No size threshold — all valid JSON is converted (per design decision)
- Quick prefix check avoids JSON.parse on plain text (performance)
- Runs on every clipboard change (300ms poll)

---

## 9. Config File

Location: `~/.pastoon/config.json`

```typescript
interface PastoonConfig {
  autoConvert: boolean;       // default: true
  delimiter: "," | "\t" | "|"; // default: ","
  keyFolding: "off" | "safe"; // default: "off"
  notifications: boolean;     // default: true
  pollInterval: number;       // default: 300 (ms)
}
```

Config is read at startup. No hot-reload in v1 (requires restart).

---

## 10. SETUP.md — "Give This to Your Agent"

This file is the primary distribution mechanism for the "agent installs
it for me" workflow. A developer finds `pastoon`, copies SETUP.md, pastes
it to their coding agent, and says "set this up."

The agent reads the file, runs the commands, and from that point on every
JSON the developer copies is auto-converted to TOON.

### Structure

SETUP.md has four tiers, ordered by effort/value:

**Tier 1 — Clipboard auto-conversion** (the main feature, ~10 seconds)  
**Tier 2 — MCP server for coding agents** (programmatic conversion)  
**Tier 3 — Manual CLI usage** (pipe mode, scripting)  
**Tier 4 — Uninstall / pause** (escape hatches)

Each tier has copy-paste commands, no explanation of internals needed.

---

## 11. SKILL.md — Coding Agent Workflow Instruction

A short markdown file that teaches a coding agent *when* to use pastoon's
MCP tools, without being a conversion engine itself (which would burn tokens).

Contents:
- When to call `json_to_toon`: before reasoning over large JSON data (>10 lines)
- When to call `toon_to_json`: when you need to modify and re-serialize
- When NOT to convert: tiny JSON (`{"ok": true}`), JSON being written to a file

This file can be placed in `AGENTS.md`, `CLAUDE.md`, or whatever system
prompt file the user's agent reads.

---

## 12. Use Cases

| Scenario | Interface | How |
|----------|-----------|-----|
| Copy JSON from browser, paste into LLM chat | Tray (auto) | Copy JSON → clipboard silently becomes TOON → paste |
| Copy JSON from browser, paste into coding agent | Tray (auto) | Same as above |
| Agent fetches JSON from API, reasons over it | MCP `json_to_toon` | Agent calls tool before including in context |
| Shell pipeline: curl API → convert → LLM CLI | `--pipe` | `curl url \| pastoon --pipe \| llm "summarize"` |
| PR review: copy JSON fixture, ask LLM to explain | Tray (auto) | Copy JSON → paste TOON |
| I want TOON but have auto-convert paused | CLI one-shot | `pastoon` (runs once) |
| Reverse: agent outputs TOON, I need JSON | Tray menu / `--reverse` | Click "Reverse" in menu or `pastoon --reverse` |

---

## 13. Out of Scope (v1)

- Windows and Linux (architecture supports it via `clipboardy` + `systray2`, not tested)
- Settings UI window (future Electrobun migration)
- Browser extension
- Token savings statistics in tray
- Custom encoding options via tray UI (config file only in v1)
- Raycast / Alfred extension

---

## 14. Future (v2)

- **Electrobun migration**: Replace `systray2` + LaunchAgent with a proper
  Electrobun desktop app. Gains: auto-update, settings window, token savings
  dashboard, smaller distribution bundle.
- **Windows / Linux**: Already cross-platform at the library level, just
  needs platform-specific setup commands (Task Scheduler on Windows,
  systemd user service on Linux).
- **Raycast extension**: One-click conversion from Raycast.
- **Stats overlay**: Show "saved X tokens today" in the tray tooltip.

---

## 15. Repository Structure (target)

```
pastoon/
├── src/
│   ├── core.ts
│   ├── cli.ts
│   ├── tray.ts
│   ├── mcp.ts
│   ├── launchagent.ts
│   └── config.ts
├── docs/
│   ├── plans/
│   │   └── 2026-03-17-pastoon-design.md   ← this file
│   ├── SETUP.md
│   └── SKILL.md
├── test/
│   ├── core.test.ts
│   ├── cli.test.ts
│   └── mcp.test.ts
├── package.json
├── tsconfig.json
├── README.md
└── .gitignore
```

---

## 16. Twitter launch pitch (reference)

> Copy JSON. Paste TOON. 40% fewer LLM tokens, automatically.
>
> `pastoon` runs in your menu bar, converts every JSON you copy
> into TOON format before you paste it into an LLM.
>
> One setup. Works forever. Open source.
>
> `npm install -g pastoon && pastoon setup`
>
> github.com/pastoon/pastoon
