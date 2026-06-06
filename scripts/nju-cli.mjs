#!/usr/bin/env node
import { spawn } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function binaryPath() {
  if (process.platform === "linux" && process.arch === "x64") return join(root, "bin/linux-x86_64/nju-cli")
  if (process.platform === "linux" && process.arch === "arm64") return join(root, "bin/linux-aarch64/nju-cli")
  if (process.platform === "darwin" && process.arch === "arm64") return join(root, "bin/macos-aarch64/nju-cli")
  if (process.platform === "win32" && process.arch === "x64") return join(root, "bin/windows-x86_64/nju-cli.exe")

  throw new Error(`nju-cli is not packaged for ${process.platform}/${process.arch}`)
}

const child = spawn(binaryPath(), process.argv.slice(2), {
  stdio: "inherit",
  windowsHide: true,
})

child.on("error", (error) => {
  console.error(error.message)
  process.exit(1)
})

child.on("close", (code, signal) => {
  if (signal) {
    console.error(`nju-cli terminated by ${signal}`)
    process.exit(1)
  }
  process.exit(code ?? 1)
})
