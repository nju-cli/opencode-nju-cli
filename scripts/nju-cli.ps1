$ErrorActionPreference = "Stop"

$ReleaseTag = "v1.4.4"
$Repo = "nju-cli/nju-cli"
$NjuMirrorUrl = "https://mirror.nju.edu.cn/github-release/$Repo"
$DownloadMirror = $null
$PluginDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$Bin = Join-Path $PluginDir "bin/windows-x86_64/nju-cli.exe"
$ChecksumFile = Join-Path $PSScriptRoot "nju-cli.sha256"
$Target = "windows-x86_64"
$Asset = "nju-cli-windows-x86_64.zip"

$ForwardArgs = @()
foreach ($Arg in $args) {
  if ($Arg -like "--download-mirror=*") {
    $DownloadMirror = $Arg.Substring("--download-mirror=".Length)
    if ([string]::IsNullOrWhiteSpace($DownloadMirror)) {
      Write-Error "--download-mirror requires a non-empty value"
    }
  } elseif ($Arg -eq "--download-mirror") {
    Write-Error "--download-mirror requires the --download-mirror=VALUE form"
  } else {
    $ForwardArgs += $Arg
  }
}

function Write-DownloadMirrorList {
  Write-Error "unsupported download mirror: $DownloadMirror`navailable download mirrors:`n  nju  $NjuMirrorUrl/"
}

function Get-ReleaseAssetUrl {
  if ([string]::IsNullOrWhiteSpace($DownloadMirror)) {
    return "https://github.com/$Repo/releases/download/$ReleaseTag/$Asset"
  }

  if ($DownloadMirror -eq "nju") {
    $Base = $NjuMirrorUrl
  } else {
    Write-DownloadMirrorList
  }

  return "$Base/$ReleaseTag/$Asset"
}

function Test-LfsPointer($Path) {
  if (!(Test-Path $Path)) {
    return $false
  }
  try {
    $FirstLine = Get-Content -LiteralPath $Path -TotalCount 1 -ErrorAction Stop
    return $FirstLine -eq "version https://git-lfs.github.com/spec/v1"
  } catch {
    return $false
  }
}

function Test-UsableBinary($Path) {
  return (Test-Path $Path) -and !(Test-LfsPointer $Path)
}

function Get-ExpectedSha($Path, $TargetName) {
  if (!(Test-Path $Path)) {
    return $null
  }
  foreach ($Line in Get-Content -LiteralPath $Path) {
    $Parts = $Line -split "\s+"
    if ($Parts.Count -ge 2 -and $Parts[1] -eq $TargetName) {
      return $Parts[0]
    }
  }
  return $null
}

function Save-ReleaseAsset($Destination) {
  $Url = Get-ReleaseAssetUrl
  Invoke-WebRequest -Uri $Url -OutFile $Destination
}

function Expand-NjuCli($Archive, $Destination, $TempDir) {
  Expand-Archive -Path $Archive -DestinationPath $TempDir -Force
  $Found = Get-ChildItem -Path $TempDir -Recurse -File -Filter "nju-cli.exe" | Select-Object -First 1
  if ($null -eq $Found) {
    Write-Error "downloaded $Asset, but could not find nju-cli.exe inside it"
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  Copy-Item -LiteralPath $Found.FullName -Destination $Destination -Force
}

$CacheBase = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { [System.IO.Path]::GetTempPath() }
$CacheBin = Join-Path $CacheBase "nju-cli-plugin/$ReleaseTag/$Target/nju-cli.exe"

if (!(Test-UsableBinary $Bin)) {
  if (Test-UsableBinary $CacheBin) {
    $Bin = $CacheBin
  } else {
    Write-Host "nju-cli $ReleaseTag is not packaged locally. Downloading $Target..."
    $TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
    $Archive = Join-Path $TempDir $Asset
    Save-ReleaseAsset $Archive
    Expand-NjuCli $Archive $CacheBin $TempDir
    $Bin = $CacheBin
  }
}

$ExpectedSha = Get-ExpectedSha $ChecksumFile $Target
if ($ExpectedSha) {
  $ActualSha = (Get-FileHash -Algorithm SHA256 -LiteralPath $Bin).Hash.ToLowerInvariant()
  if ($ActualSha -ne $ExpectedSha) {
    Write-Error "nju-cli checksum mismatch for ${Target}. Expected $ExpectedSha, got $ActualSha"
  }
}

& $Bin @ForwardArgs
exit $LASTEXITCODE
