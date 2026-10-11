---
name: openbrowser-mcp
description: Guardrails and operational protocols for browser automation, CDP emulation, screenshot handling, and session cleanup with the openbrowser MCP.
---

# `openbrowser` MCP Automation Guardrails

## 1. Server & Tool Identification
- When the user refers to "openchrome", "openbrowser", or browser automation tools, target the **`openbrowser`** MCP server using its **`execute_code`** tool.

## 2. Screenshot & Workspace Cleanliness
- **No Workspace Clutter**: NEVER save screenshots or transient artifacts into the project workspace (e.g. `d:\projects\...`).
- **Scratch Storage**: Always save verification images to the agent session scratch path (`<appDataDir>/brain/<conversation-id>/scratch/`) or Windows temp directory (`$env:TEMP`).
- **Inspection & Cleanup**: Inspect screenshots using `view_file` and immediately delete the temporary file after verification to leave zero disk footprint.

## 3. Emulation & User-Agent Overrides
- When emulating device profiles (such as Smart TV / YouTube Leanback) or custom User-Agents, apply overrides across both CDP domains:
  ```python
  cdp = await browser.get_or_create_cdp_session()
  await cdp.cdp_client.send_raw('Network.setUserAgentOverride', {'userAgent': ua}, session_id=cdp.session_id)
  await cdp.cdp_client.send_raw('Emulation.setUserAgentOverride', {'userAgent': ua}, session_id=cdp.session_id)
  ```
- For YouTube TV Leanback mode, use the PS4 Leanback User Agent and append startup query parameters:
  - UA: `Mozilla/5.0 (PS4; Leanback Shell) Gecko/20100101 Firefox/65.0 LeanbackShell/01.00.01.75 Sony PS4/ (PS4, , no, CH)`
  - URL: `https://www.youtube.com/tv#/?env_forceFullAnimation=true&env_isLimitedMemory=false&env_disableStartupDialog=true`

## 4. Lifecycle Management
- Always explicitly stop the browser session upon task completion using:
  ```python
  await browser.stop()
  ```
- Do not leave headless or remote browser instances running in the background after finishing navigation or checks.
