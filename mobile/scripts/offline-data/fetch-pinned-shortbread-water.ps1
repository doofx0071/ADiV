param(
  [string]$WorkDirectory = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path "work/offline-data/shortbread-data")
)

$ErrorActionPreference = "Stop"
$lockPath = Join-Path $PSScriptRoot "source-lock.json"
$lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
$workPath = [System.IO.Path]::GetFullPath($WorkDirectory)
New-Item -ItemType Directory -Path $workPath -Force | Out-Null

foreach ($asset in $lock.shortbreadAuxiliaryData) {
  $target = Join-Path $workPath $asset.name
  $integrityPath = "$target.integrity.json"
  $head = Invoke-WebRequest -Uri $asset.url -Method Head
  # PowerShell exposes WebHeaderCollection values as String[] even when a header
  # has one value, so select and cast the scalar explicitly before parsing.
  $headContentLength = [long]([string]($head.Headers["Content-Length"] | Select-Object -First 1))
  $headEtag = [string]($head.Headers["ETag"] | Select-Object -First 1)
  $headLastModified = [string]($head.Headers["Last-Modified"] | Select-Object -First 1)
  $headDate = ([DateTimeOffset]::Parse($headLastModified).ToUniversalTime()).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
  $expectedDate = ([DateTimeOffset]$asset.lastModified).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
  if ($headContentLength -ne [long]$asset.bytes -or $headEtag -ne $asset.etag -or $headDate -ne $expectedDate) {
    throw "Pinned auxiliary source metadata changed for $($asset.name). The source lock needs review before download."
  }

  if (Test-Path -LiteralPath $target) {
    $sidecar = if (Test-Path -LiteralPath $integrityPath) { Get-Content -LiteralPath $integrityPath -Raw | ConvertFrom-Json } else { $null }
    $actualSha = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    if ((Get-Item -LiteralPath $target).Length -ne [long]$asset.bytes -or $sidecar.etag -ne $asset.etag -or $sidecar.sha256 -ne $actualSha) {
      throw "Existing auxiliary input is not verified against its integrity record: $target. It was left untouched."
    }
    continue
  }

  $temporary = Join-Path $workPath "$($asset.name).$([guid]::NewGuid().ToString('N')).partial"
  try {
    Write-Host "Downloading locked Shortbread input $($asset.name) ($([math]::Round($asset.bytes / 1MB)) MB)..."
    Invoke-WebRequest -Uri $asset.url -OutFile $temporary
    $downloaded = Get-Item -LiteralPath $temporary
    if ($downloaded.Length -ne [long]$asset.bytes) {
      throw "Downloaded size mismatch for $($asset.name): expected $($asset.bytes), got $($downloaded.Length)."
    }
    $sha256 = (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant()
    Move-Item -LiteralPath $temporary -Destination $target
    [ordered]@{
      source = $asset.url
      bytes = [long]$asset.bytes
      etag = $asset.etag
      lastModified = $asset.lastModified
      sha256 = $sha256
      license = $asset.license
    } | ConvertTo-Json | Set-Content -LiteralPath $integrityPath -Encoding utf8
    Write-Host "Verified input: $target"
    Write-Host "SHA-256: $sha256"
  } finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
  }
}
