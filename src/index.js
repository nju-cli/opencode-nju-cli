import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { dirname, join, normalize, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { tool } from "@opencode-ai/plugin"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function binaryPath() {
  const platform = process.platform
  const arch = process.arch

  if (platform === "linux" && arch === "x64") return join(root, "bin/linux-x86_64/nju-cli")
  if (platform === "linux" && arch === "arm64") return join(root, "bin/linux-aarch64/nju-cli")
  if (platform === "darwin" && arch === "arm64") return join(root, "bin/macos-aarch64/nju-cli")
  if (platform === "win32" && arch === "x64") return join(root, "bin/windows-x86_64/nju-cli.exe")

  throw new Error(`nju-cli is not packaged for ${platform}/${arch}`)
}

function runNjuCli(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath(), args, {
      cwd,
      env: process.env,
      windowsHide: true,
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", reject)
    child.on("close", (code) => {
      const output = [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join("\n")
      if (code === 0) {
        resolve(output || "nju-cli completed successfully with no output.")
        return
      }
      reject(new Error(`nju-cli exited with code ${code}\n${output}`.trim()))
    })
  })
}

async function readSkillDoc(topic) {
  const docsRoot = join(root, "skills/nju-cli")
  const requested = topic && topic !== "overview" ? topic : "SKILL.md"
  const target = normalize(join(docsRoot, requested))
  const rel = relative(docsRoot, target)

  if (rel.startsWith("..") || rel === "" || rel.includes("..")) {
    throw new Error("topic must be a bundled nju-cli skill document path")
  }
  if (!target.endsWith(".md")) {
    throw new Error("topic must point to a Markdown skill document")
  }

  return readFile(target, "utf8")
}

export const NjuCliPlugin = async ({ directory }) => {
  return {
    tool: {
      nju_cli: tool({
        description:
          "Run the bundled nju-cli binary for Nanjing University services: academic affairs notices/calendar, ehall grades/course schedule/training program/courses, exchange-system news/projects, and youth-league notices. For unfamiliar NJU workflows, call nju_cli_docs first to read the bundled skill guidance, then pass command-line arguments as an array, for example [\"academic-affairs\", \"notices\", \"--help\"].",
        args: {
          args: tool.schema.array(tool.schema.string()).describe("Arguments to pass to nju-cli."),
          cwd: tool.schema.string().optional().describe("Working directory. Defaults to the current OpenCode project directory."),
        },
        async execute(args) {
          return runNjuCli(args.args, args.cwd || directory)
        },
      }),
      nju_cli_docs: tool({
        description:
          "Read the bundled nju-cli skill docs included in this OpenCode npm plugin. Use this before choosing nju-cli subcommands for Nanjing University academic affairs, ehall grades/course schedule/training program/courses, exchange-system news/projects, and youth-league workflows.",
        args: {
          topic: tool.schema
            .string()
            .optional()
            .describe(
              "Bundled Markdown path relative to skills/nju-cli, such as SKILL.md, subcommands/ehall.md, or subcommands/academic-affairs.md.",
            ),
        },
        async execute(args) {
          return readSkillDoc(args.topic)
        },
      }),
    },
  }
}
