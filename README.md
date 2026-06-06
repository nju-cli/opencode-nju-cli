# NJU CLI OpenCode Plugin

This package provides an OpenCode plugin for `nju-cli`, with bundled OpenCode-compatible skill docs for Nanjing University workflows.

## Install

Add the npm plugin to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-nju-cli"]
}
```

OpenCode installs npm plugins automatically at startup with Bun.

That is the full install path. Users do not need to copy skill files manually.

## Tools

The plugin exposes two tools:

- `nju_cli`: runs the bundled `nju-cli` binary.
- `nju_cli_docs`: reads the bundled skill guidance before choosing a subcommand.

Example prompt:

```text
用 nju_cli_docs 看一下 ehall 怎么查培养方案，然后用 nju_cli 查询。
```

## Optional Native OpenCode Skill

The npm package already contains `skills/nju-cli/SKILL.md`, and the plugin exposes it through `nju_cli_docs`.

OpenCode's native `skill` tool only discovers skills from configured skill directories:

- `.opencode/skills/<name>/SKILL.md`
- `~/.config/opencode/skills/<name>/SKILL.md`
- `.claude/skills/<name>/SKILL.md`
- `~/.claude/skills/<name>/SKILL.md`
- `.agents/skills/<name>/SKILL.md`
- `~/.agents/skills/<name>/SKILL.md`

Only copy `skills/nju-cli` if you specifically want `nju-cli` to appear in that native `skill` tool list:

```bash
mkdir -p ~/.config/opencode/skills
cp -R skills/nju-cli ~/.config/opencode/skills/
```

For project-local use, copy `skills/nju-cli` to `.opencode/skills/nju-cli`.

## Packaged CLI

The package includes release binaries under `bin/` and wrappers under `scripts/`.

Supported packaged targets:

- Linux x86_64
- Linux aarch64, when release artifacts are synced
- macOS Apple Silicon
- Windows x86_64

The `nju-cli` binary is built and released from <https://github.com/nju-cli/nju-cli>.

## Development

Dry-run the npm package contents:

```bash
npm pack --dry-run
```
