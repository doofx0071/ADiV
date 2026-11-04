param(
  [string]$WorkDirectory = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path "work/offline-data")
)

$ErrorActionPreference = "Stop"
$lockPath = Join-Path $PSScriptRoot "source-lock.json"
$lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
$workPath = [System.IO.Path]::GetFullPath($WorkDirectory)
New-Item -ItemType Directory -Path $workPath -Force | Out-Null

$fileName = "philippines-$($lock.snapshotDate.Replace('-', '')).osm.pbf"
$target = Join-Path $workPath $fileName
$integrityPath = "$target.integrity.json"

function Get-PbfMd5([string]$Path) {
  (Get-FileHash -LiteralPath $Path -Algorithm MD5).Hash.ToLowerInvariant()
}

if (Test-Path -LiteralPath $target) {
  $existing = Get-Item -LiteralPath $target
  if ($existing.Length -ne [long]$lock.bytes -or (Get-PbfMd5 $target) -ne $lock.md5.ToLowerInvariant()) {
    throw "Existing input does not match the locked Geofabrik snapshot: $target. It was left untouched."
  }
} else {
  $temporary = Join-Path $workPath "$fileName.$([guid]::NewGuid().ToString('N')).partial"
  try {
    Write-Host "Downloading locked Geofabrik PBF ($([math]::Round($lock.bytes / 1MB)) MB)..."
    Invoke-WebRequest -Uri $lock.url -OutFile $temporary
    $downloaded = Get-Item -LiteralPath $temporary
    if ($downloaded.Length -ne [long]$lock.bytes) {
      throw "Downloaded PBF size mismatch: expected $($lock.bytes), got $($downloaded.Length)."
    }
    $md5 = Get-PbfMd5 $temporary
    if ($md5 -ne $lock.md5.ToLowerInvariant()) {
      throw "Downloaded PBF MD5 mismatch. The locked source snapshot was not installed."
    }
    Move-Item -LiteralPath $temporary -Destination $target
  } finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
  }
}

$result = [ordered]@{
  source = $lock.url
  snapshotDate = $lock.snapshotDate
  bytes = (Get-Item -LiteralPath $target).Length
  md5 = Get-PbfMd5 $target
  sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
  osmDataTimestamp = $lock.osmDataTimestamp
}
$result | ConvertTo-Json | Set-Content -LiteralPath $integrityPath -Encoding utf8
Write-Host "Verified input: $target"
Write-Host "SHA-256: $($result.sha256)"
