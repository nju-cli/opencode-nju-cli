# NJU CLI OpenCode Plugin

This package provides an OpenCode plugin for `nju-cli`, plus bundled OpenCode-compatible skill docs for Nanjing University workflows.

## Install

Add the npm plugin to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-nju-cli"]
}
```

OpenCode installs npm plugins automatically at startup with Bun.

## Tools

The plugin exposes two tools:

- `nju_cli`: runs the bundled `nju-cli` binary.
- `nju_cli_docs`: reads bundled skill guidance before choosing a subcommand.

Example prompt:

```text
用 nju_cli_docs 看一下 ehall 怎么查培养方案，然后用 nju_cli 查询。
```

## Optional Native OpenCode Skill

OpenCode discovers native skills from `.opencode/skills/<name>/SKILL.md` or `~/.config/opencode/skills/<name>/SKILL.md`.

The npm plugin already exposes `nju_cli_docs`, so this copy step is optional. If you want OpenCode's native `skill` tool to discover `nju-cli`, copy `skills/nju-cli` from this repository or unpacked package to one of the native skill paths:

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
