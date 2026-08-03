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
      if (-not $response.IsSuccessStatusCode) {
        $status = [int]$response.StatusCode
        $response.Dispose()
        throw [InvalidOperationException]::new("Runtime download failed with HTTP status $status.")
      }
      Assert-AllowedUri $response.RequestMessage.RequestUri
      $input = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
      $output = [IO.File]::Open($Destination,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None)
      $cancel = [Threading.CancellationTokenSource]::new([TimeSpan]::FromMinutes(5))
      $buffer = New-Object byte[] (256 * 1024)
      $received = [int64]0
      $total = $response.Content.Headers.ContentLength
      $watch = [Diagnostics.Stopwatch]::StartNew()
      try {
        while ($true) {
          $count = $input.ReadAsync($buffer,0,$buffer.Length,$cancel.Token).GetAwaiter().GetResult()
          if ($count -eq 0) { break }
          $output.Write($buffer,0,$count); $received += $count
          $speed = ($received / 1MB) / [Math]::Max($watch.Elapsed.TotalSeconds,0.001)
          if ($null -ne $total -and $total -gt 0) {
            $percent = [Math]::Min(100,[int](100*$received/$total))
            $done = [Math]::Min(20,[int](20*$received/$total))
            $bar = ('#' * $done) + ('-' * (20-$done))
            Write-Host -NoNewline ("\r[1/7] Portable Python [{0}] {1}% {2:N1}/{3:N1} MB {4:N1} MB/s" -f $bar,$percent,($received/1MB),($total/1MB),$speed)
          } else {
            Write-Host -NoNewline ("\r[1/7] Portable Python | {0} bytes {1:N1}s" -f $received,$watch.Elapsed.TotalSeconds)
          }
        }
        if ($null -ne $total -and $total -gt 0 -and $received -ne $total) { throw [IO.EndOfStreamException]::new('Runtime download was interrupted.') }
        Write-Host
      } finally {
        $cancel.Dispose(); $output.Dispose(); $input.Dispose(); $response.Dispose()
      }
      return
    }
    throw 'Download blocked: too many redirects.'
  } finally { $client.Dispose(); $handler.Dispose() }
}

function Get-AllowedDownloadWithRetry([Uri]$Uri, [string]$Destination) {
  for ($attempt=1; $attempt -le 3; $attempt++) {
    try {
      Get-AllowedDownload $Uri $Destination
      return
    } catch [Net.Http.HttpRequestException], [Threading.Tasks.TaskCanceledException], [IO.IOException] {
      Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
      if ($attempt -eq 3) { throw }
      Write-Host "Temporary download error. Retrying in 2 seconds ($attempt/3)..."
      Start-Sleep -Seconds 2
    }
  }
}

function Get-Sha256([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
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
    Get-AllowedDownloadWithRetry ([Uri]$Manifest.python.url) $Part
    $Actual = Get-Sha256 $Part
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
