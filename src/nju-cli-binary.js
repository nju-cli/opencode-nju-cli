import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createWriteStream } from "node:fs"
import { access, copyFile, mkdir, mkdtemp, open, readFile, readdir } from "node:fs/promises"
import { constants } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

export const releaseTag = "v1.6"
const repo = "nju-cli/nju-cli"
const njuMirrorUrl = `https://mirror.nju.edu.cn/github-release/${repo}`

function targetInfo() {
  if (process.platform === "linux" && process.arch === "x64") {
    return {
      target: "linux-x86_64",
      asset: "nju-cli-linux-x86_64.tar.gz",
      binaryName: "nju-cli",
      packaged: join(root, "bin/linux-x86_64/nju-cli"),
    }
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return {
      target: "linux-aarch64",
      asset: "nju-cli-linux-aarch64.tar.gz",
      binaryName: "nju-cli",
      packaged: join(root, "bin/linux-aarch64/nju-cli"),
    }
  }
  if (process.platform === "darwin" && process.arch === "arm64") {
    return {
      target: "macos-aarch64",
      asset: "nju-cli-macos-aarch64.tar.gz",
      binaryName: "nju-cli",
      packaged: join(root, "bin/macos-aarch64/nju-cli"),
    }
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return {
      target: "windows-x86_64",
      asset: "nju-cli-windows-x86_64.zip",
      binaryName: "nju-cli.exe",
      packaged: join(root, "bin/windows-x86_64/nju-cli.exe"),
    }
  }

  throw new Error(`nju-cli is not packaged for ${process.platform}/${process.arch}`)
}

export function parseDownloadMirrorArgs(args) {
  let downloadMirror
  const forwardArgs = []

  for (const arg of args) {
    if (arg.startsWith("--download-mirror=")) {
      downloadMirror = arg.slice("--download-mirror=".length)
      if (!downloadMirror.trim()) {
        throw new Error("--download-mirror requires a non-empty value")
      }
    } else if (arg === "--download-mirror") {
      throw new Error("--download-mirror requires the --download-mirror=VALUE form")
    } else {
      forwardArgs.push(arg)
    }
  }

  if (downloadMirror === "nju") {
    downloadMirror = njuMirrorUrl
  } else if (downloadMirror) {
    throw new Error(`unsupported download mirror: ${downloadMirror}\navailable download mirrors:\n  nju  ${njuMirrorUrl}/`)
  }

  return { downloadMirror: downloadMirror ?? "", forwardArgs }
}

async function isLfsPointer(path) {
  let file
  try {
    file = await open(path, "r")
    const buffer = Buffer.alloc(48)
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0)
    return buffer.subarray(0, bytesRead).toString("utf8").startsWith("version https://git-lfs.github.com/spec/v1")
  } catch {
    return false
  } finally {
    await file?.close()
  }
}

async function isUsableBinary(path) {
  try {
    await access(path, process.platform === "win32" ? constants.F_OK : constants.X_OK)
    return !(await isLfsPointer(path))
  } catch {
    return false
  }
}

function cacheBase() {
  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA || process.env.APPDATA || tmpdir()
  }
  if (process.env.XDG_CACHE_HOME) return process.env.XDG_CACHE_HOME
  const home = homedir()
  return home ? join(home, ".cache") : tmpdir()
}

async function expectedSha(target) {
  try {
    const checksums = await readFile(join(root, "scripts/nju-cli.sha256"), "utf8")
    for (const line of checksums.split(/\r?\n/)) {
      const [sha, lineTarget] = line.trim().split(/\s+/)
      if (lineTarget === target) return sha
    }
  } catch {
    return undefined
  }
  return undefined
}

async function sha256File(path) {
  const hash = createHash("sha256")
  hash.update(await readFile(path))
  return hash.digest("hex")
}

async function verifyChecksum(path, target) {
  const expected = await expectedSha(target)
  if (!expected) return
  const actual = await sha256File(path)
  if (actual !== expected) {
    throw new Error(`nju-cli checksum mismatch for ${target}. Expected ${expected}, got ${actual}`)
  }
}

async function download(url, destination) {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`failed to download ${url}: HTTP ${response.status}`)
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

async function findFile(dir, name) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isFile() && entry.name === name) return path
    if (entry.isDirectory()) {
      const found = await findFile(path, name)
      if (found) return found
    }
  }
  return undefined
}

async function extractBinary(archive, destination, tempDir, info) {
  if (info.asset.endsWith(".zip")) {
    await run("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${tempDir.replaceAll("'", "''")}' -Force`,
    ])
  } else {
    await run("tar", ["-C", tempDir, "-xzf", archive])
  }

  const found = await findFile(tempDir, info.binaryName)
  if (!found) {
    throw new Error(`downloaded ${info.asset}, but could not find ${info.binaryName} inside it`)
  }

  await mkdir(dirname(destination), { recursive: true })
  await copyFile(found, destination)
  if (process.platform !== "win32") {
    await run("chmod", ["+x", destination])
  }
}

export async function resolveNjuCli(downloadMirror = "") {
  const info = targetInfo()
  if (await isUsableBinary(info.packaged)) {
    await verifyChecksum(info.packaged, info.target)
    return info.packaged
  }

  const cacheBin = join(cacheBase(), "nju-cli-plugin", releaseTag, info.target, info.binaryName)
  if (await isUsableBinary(cacheBin)) {
    await verifyChecksum(cacheBin, info.target)
    return cacheBin
  }

  const baseUrl = downloadMirror || `https://github.com/${repo}/releases/download`
  const url = `${baseUrl}/${releaseTag}/${info.asset}`
  console.error(`nju-cli ${releaseTag} is not packaged locally; downloading ${info.target}...`)

  const tempDir = await mkdtemp(join(tmpdir(), "nju-cli."))
  const archive = join(tempDir, basename(info.asset))
  await download(url, archive)
  await extractBinary(archive, cacheBin, tempDir, info)
  await verifyChecksum(cacheBin, info.target)
  return cacheBin
}
