$ErrorActionPreference = "Stop"

$PluginDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$Bin = Join-Path $PluginDir "bin/windows-x86_64/nju-cli.exe"

if (!(Test-Path $Bin)) {
  Write-Error "nju-cli binary is not packaged for Windows; sync package binaries from a release first"
}

& $Bin @args
exit $LASTEXITCODE
