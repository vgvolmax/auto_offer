param([Alias('no-browser')][switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$ManifestPath = Join-Path $PSScriptRoot 'runtime-manifest.json'
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$Runtime = Join-Path $Root '.runtime'
$PythonDir = Join-Path $Runtime 'python'
$Python = Join-Path $PythonDir $Manifest.python.executable
$Receipt = Join-Path $PythonDir 'install-receipt.json'
$Downloads = Join-Path $Runtime 'downloads'
$Archive = Join-Path $Downloads 'python.zip'
$AllowedHosts = @($Manifest.download_hosts | ForEach-Object { $_.ToLowerInvariant() })
Add-Type -AssemblyName System.Net.Http

# This OS-owned byte-range lock covers the complete mutation window, including the
# first Python download.  The persistent file is metadata, never a sentinel.
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
$LockPath = Join-Path $Runtime 'launcher.lock'
$Lock = [IO.File]::Open($LockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::ReadWrite)
$Deadline = [DateTime]::UtcNow.AddMinutes(20)
while ($true) {
  try { $Lock.Lock(0,1); break }
  catch [IO.IOException] {
    if ([DateTime]::UtcNow -ge $Deadline) { $Lock.Dispose(); throw 'Another launcher is still preparing Auto Offer after 20 minutes.' }
    Write-Host '[lock] Another launcher is preparing Auto Offer; waiting...'
    Start-Sleep -Milliseconds 500
  }
}
try {
$Lock.SetLength(0)
$Metadata = [Text.Encoding]::UTF8.GetBytes((@{pid=$PID;acquired=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress))
$Lock.Write($Metadata,0,$Metadata.Length); $Lock.Flush()

function Assert-AllowedUri([Uri]$Uri) {
  if ($Uri.Scheme -ne 'https') { throw 'Download blocked: HTTPS is required (HTTP downgrade is forbidden).' }
  if ($AllowedHosts -notcontains $Uri.DnsSafeHost.ToLowerInvariant()) { throw 'Download blocked: redirect host is not in the launcher allowlist.' }
}

function Get-AllowedDownload([Uri]$Uri, [string]$Destination) {
  $handler = [Net.Http.HttpClientHandler]::new(); $handler.AllowAutoRedirect = $false
  $client = [Net.Http.HttpClient]::new($handler); $client.Timeout = [TimeSpan]::FromSeconds(60)
  try {
    for ($redirects=0; $redirects -le 10; $redirects++) {
      Assert-AllowedUri $Uri
      $response = $client.GetAsync($Uri, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
      if ([int]$response.StatusCode -in 301,302,303,307,308) {
        $location = $response.Headers.Location; $response.Dispose()
        if ($null -eq $location) { throw 'Download blocked: redirect has no destination.' }
        $Uri = if ($location.IsAbsoluteUri) { $location } else { [Uri]::new($Uri,$location) }
        Assert-AllowedUri $Uri
        continue
      }
      $response.EnsureSuccessStatusCode() | Out-Null
      Assert-AllowedUri $response.RequestMessage.RequestUri
      $input = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
      $output = [IO.File]::Open($Destination,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None)
      try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose(); $response.Dispose() }
      return
    }
    throw 'Download blocked: too many redirects.'
  } finally { $client.Dispose(); $handler.Dispose() }
}

function Test-PortablePython([string]$Directory) {
  $exe = Join-Path $Directory $Manifest.python.executable
  if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { return $false }
  foreach ($required in @('python3.dll', "python$($Manifest.python.version.Replace('.','').Substring(0,3)).dll")) {
    if (-not (Test-Path -LiteralPath (Join-Path $Directory $required) -PathType Leaf)) { return $false }
  }
  $receiptPath = Join-Path $Directory 'install-receipt.json'
  try {
    $installed = & $exe -c 'import platform; print(platform.python_version())' 2>$null
    if ($LASTEXITCODE -ne 0 -or "$installed".Trim() -ne $Manifest.python.version) { return $false }
    $saved = Get-Content -LiteralPath $receiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
    return $saved.schema_version -eq 1 -and $saved.version -eq $Manifest.python.version -and $saved.sha256 -eq $Manifest.python.sha256
  } catch { return $false }
}

New-Item -ItemType Directory -Force -Path $Downloads | Out-Null
# An interrupted install is never a candidate. Clean only bootstrap-owned temporary directories.
Get-ChildItem -LiteralPath $Runtime -Directory -Filter 'python.new-*' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
if (-not (Test-PortablePython $PythonDir)) {
  Write-Host '[1/7] Portable Python: repair/download and checksum verification'
  $Part = "$Archive.part"; Remove-Item -LiteralPath $Part -Force -ErrorAction SilentlyContinue
  $Temp = Join-Path $Runtime "python.new-$PID-$([Guid]::NewGuid().ToString('N'))"
  try {
    Get-AllowedDownload ([Uri]$Manifest.python.url) $Part
    $Actual = (Get-FileHash -LiteralPath $Part -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Actual -ne $Manifest.python.sha256) {
      throw "Python SHA-256 mismatch; expected $($Manifest.python.sha256), actual $Actual; downloaded archive was not installed."
    }
    Move-Item -LiteralPath $Part -Destination $Archive -Force
    New-Item -ItemType Directory -Path $Temp | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
      $Base = [IO.Path]::GetFullPath($Temp + [IO.Path]::DirectorySeparatorChar)
      foreach ($Entry in $Zip.Entries) {
        $Target = [IO.Path]::GetFullPath((Join-Path $Temp $Entry.FullName))
        if (-not $Target.StartsWith($Base,[StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe entry in Python archive.' }
      }
    } finally { $Zip.Dispose() }
    [IO.Compression.ZipFile]::ExtractToDirectory($Archive,$Temp)
    @{schema_version=1;version=$Manifest.python.version;sha256=$Manifest.python.sha256} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Temp 'install-receipt.json') -Encoding UTF8
    if (-not (Test-PortablePython $Temp)) { throw 'Portable Python validation failed; runtime was not published.' }
    $Old = Join-Path $Runtime "python.old-$PID"
    Remove-Item -LiteralPath $Old -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $PythonDir) { Move-Item -LiteralPath $PythonDir -Destination $Old }
    try { Move-Item -LiteralPath $Temp -Destination $PythonDir } catch { if (Test-Path $Old) { Move-Item $Old $PythonDir }; throw }
    Remove-Item -LiteralPath $Old -Recurse -Force -ErrorAction SilentlyContinue
  } catch {
    Remove-Item -LiteralPath $Part -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
    Write-Error $_; exit 1
  }
} else { Write-Host '[1/7] Portable Python: verified and ready' }
$LauncherArgs = @((Join-Path $PSScriptRoot 'launcher.py'),'start')
if ($NoBrowser) { $LauncherArgs += '--no-browser' }
$env:AUTO_OFFER_BOOTSTRAP_LOCK_HELD = '1'
& $Python @LauncherArgs
exit $LASTEXITCODE
} finally {
  Remove-Item Env:AUTO_OFFER_BOOTSTRAP_LOCK_HELD -ErrorAction SilentlyContinue
  try { $Lock.Unlock(0,1) } finally { $Lock.Dispose() }
}
