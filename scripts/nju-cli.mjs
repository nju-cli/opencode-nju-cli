#!/usr/bin/env node
import { spawn } from "node:child_process"
import { parseDownloadMirrorArgs, resolveNjuCli } from "../src/nju-cli-binary.js"

let bin
let forwardArgs
try {
  const parsed = parseDownloadMirrorArgs(process.argv.slice(2))
  bin = await resolveNjuCli(parsed.downloadMirror)
  forwardArgs = parsed.forwardArgs
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const child = spawn(bin, forwardArgs, {
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
