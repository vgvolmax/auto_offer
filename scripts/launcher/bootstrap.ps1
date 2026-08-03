[CmdletBinding()]
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$manifestPath = Join-Path $PSScriptRoot 'runtime-manifest.json'
$runtime = Join-Path $root '.runtime'
$pythonDir = Join-Path $runtime 'python'
$backupDir = Join-Path $runtime 'python.previous'
$pythonExe = Join-Path $pythonDir 'python.exe'

function Fail([string]$message, [string]$stage) {
  $log = Join-Path $runtime 'logs\launcher.log'
  Write-Error "Что произошло: $message`nЭтап: $stage`nЧто сохранено: проверенные файлы release и данные IndexedDB не изменены`nСледующий start.bat повторит незавершённый этап`nЧто сделать: проверьте сеть/место и полностью распакованный ZIP`nЛог: $log"
}

function Get-Sha256([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  try {
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
      return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    } finally {
      $sha.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Get-RuntimeInventory([string]$Directory) {
  $fullRoot = [IO.Path]::GetFullPath($Directory).TrimEnd('\') + '\'
  $receipt = [IO.Path]::GetFullPath((Join-Path $Directory 'install-receipt.json'))
  @(
    Get-ChildItem -LiteralPath $Directory -File -Recurse | Where-Object {
      [IO.Path]::GetFullPath($_.FullName) -ne $receipt
    } | ForEach-Object {
      [pscustomobject][ordered]@{
        path = $_.FullName.Substring($fullRoot.Length).Replace('\', '/')
        size = [int64]$_.Length
        sha256 = Get-Sha256 $_.FullName
      }
    } | Sort-Object -Property path
  )
}

function Test-InstalledRuntime([string]$Directory, $Manifest) {
  try {
    $candidateExe = Join-Path $Directory 'python.exe'
    $candidateReceipt = Join-Path $Directory 'install-receipt.json'
    if (-not (Test-Path -LiteralPath $candidateExe -PathType Leaf) -or -not (Test-Path -LiteralPath $candidateReceipt -PathType Leaf)) {
      return $false
    }

    $receipt = Get-Content -LiteralPath $candidateReceipt -Raw -Encoding UTF8 | ConvertFrom-Json
    $receiptKeys = @('schema_version', 'python_version', 'archive_sha256', 'launcher_version', 'installed_at', 'files')
    if (@(Compare-Object $receiptKeys @($receipt.PSObject.Properties.Name)).Count -ne 0) { return $false }
    if (($receipt.schema_version -isnot [int]) -and ($receipt.schema_version -isnot [long])) { return $false }
    if ($receipt.schema_version -ne 2) { return $false }
    if ($receipt.python_version -isnot [string] -or $receipt.python_version -ne $Manifest.python.version) { return $false }
    if ($receipt.archive_sha256 -isnot [string] -or $receipt.archive_sha256 -ne $Manifest.python.sha256) { return $false }
    if ($receipt.launcher_version -isnot [string] -or $receipt.launcher_version -ne $Manifest.launcher_version) { return $false }
    if ($receipt.installed_at -isnot [string]) { return $false }
    [DateTimeOffset]$installedAt = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse($receipt.installed_at, [ref]$installedAt) -or $installedAt.Offset -ne [TimeSpan]::Zero) { return $false }
    if ($receipt.files -isnot [System.Array] -or $receipt.files.Count -eq 0) { return $false }

    $actualFiles = @(Get-RuntimeInventory $Directory)
    if ($actualFiles.Count -ne $receipt.files.Count) { return $false }
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    for ($index = 0; $index -lt $actualFiles.Count; $index++) {
      $expected = $receipt.files[$index]
      if (@(Compare-Object @('path', 'size', 'sha256') @($expected.PSObject.Properties.Name)).Count -ne 0) { return $false }
      if ($expected.path -isnot [string] -or -not $expected.path -or $expected.path.Contains('\')) { return $false }
      if ($expected.path.StartsWith('/') -or $expected.path.StartsWith('//') -or $expected.path -match '^[A-Za-z]:' -or $expected.path.Split('/') -contains '..') { return $false }
      if (-not $seen.Add($expected.path)) { return $false }
      if (($expected.size -isnot [int]) -and ($expected.size -isnot [long])) { return $false }
      if ($expected.size -lt 0 -or $expected.sha256 -isnot [string] -or $expected.sha256 -notmatch '^[0-9a-f]{64}$') { return $false }
      if ($actualFiles[$index].path -cne $expected.path -or $actualFiles[$index].size -ne $expected.size -or $actualFiles[$index].sha256 -cne $expected.sha256) { return $false }
    }

    $actualVersion = & $candidateExe -c 'import sys; print(sys.version.split()[0])'
    return ($LASTEXITCODE -eq 0 -and $actualVersion.Trim() -eq $Manifest.python.version)
  } catch {
    return $false
  }
}

function Write-InstallReceipt([string]$Directory, $Manifest) {
  $files = @(Get-RuntimeInventory $Directory)
  if ($files.Count -eq 0) { throw 'Portable Python extraction is empty' }
  $receipt = [ordered]@{
    schema_version = 2
    python_version = $Manifest.python.version
    archive_sha256 = $Manifest.python.sha256
    launcher_version = $Manifest.launcher_version
    installed_at = [DateTime]::UtcNow.ToString('o')
    files = $files
  }
  $path = Join-Path $Directory 'install-receipt.json'
  $part = "$path.part"
  [IO.File]::WriteAllText($part, (($receipt | ConvertTo-Json -Depth 5) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $part -Destination $path -Force
}

function Test-LocalPortOpen {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $connect = $client.ConnectAsync('127.0.0.1', 8765)
    return ($connect.Wait(500) -and $client.Connected)
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Stop-OwnedServerForRuntimeRepair {
  $statePath = Join-Path $runtime 'server.json'
  $health = $null
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/__auto_offer_health' -Method Get -TimeoutSec 2
  } catch {
    if (Test-LocalPortOpen) { throw 'Port 8765 is occupied by a foreign or unresponsive listener; runtime repair was not started' }
    # A closed fixed port proves there is no serving Auto Offer instance. PID values in
    # stale state are diagnostic only and may already belong to an unrelated process.
    return
  }

  if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { throw 'Running listener has no authenticated Auto Offer state' }
  $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
  $identityMatches = (
    $health.app_identity -eq 'auto-offer' -and
    $health.launcher_version -eq '1.0.0' -and
    $health.host -eq '127.0.0.1' -and
    $health.port -eq 8765 -and
    $health.instance_id -is [string] -and
    $health.instance_id -and
    (($health.pid -is [int]) -or ($health.pid -is [long])) -and
    $health.pid -gt 0 -and
    $state.app_identity -eq $health.app_identity -and
    $state.launcher_version -eq $health.launcher_version -and
    $state.host -eq $health.host -and
    $state.port -eq $health.port -and
    $state.instance_id -eq $health.instance_id -and
    $state.pid -eq $health.pid -and
    $state.release_fingerprint -eq $health.release_fingerprint -and
    $state.shutdown_token -is [string] -and
    $state.shutdown_token
  )
  if (-not $identityMatches) { throw 'Running listener does not match authenticated Auto Offer state; runtime repair was not started' }

  Invoke-RestMethod -Uri 'http://127.0.0.1:8765/__auto_offer_shutdown' -Method Post -Headers @{'X-Auto-Offer-Shutdown' = $state.shutdown_token} -TimeoutSec 2 | Out-Null
  for ($attempt = 0; $attempt -lt 100; $attempt++) {
    if (-not (Test-LocalPortOpen) -and -not (Test-Path -LiteralPath $statePath)) { return }
    Start-Sleep -Milliseconds 100
  }
  throw 'Authenticated Auto Offer server did not stop before runtime repair'
}

function Restore-PreviousRuntime($Manifest) {
  $activeReady = Test-InstalledRuntime $pythonDir $Manifest
  $previousReady = Test-InstalledRuntime $backupDir $Manifest
  if ($activeReady -or -not $previousReady) {
    return $activeReady
  }

  Write-Host '[1/4] Portable Python - restoring verified previous runtime'
  if (Test-Path -LiteralPath $pythonDir) {
    $invalid = Join-Path $runtime ('python.invalid-' + [guid]::NewGuid().ToString('N'))
    Move-Item -LiteralPath $pythonDir -Destination $invalid
    try {
      Move-Item -LiteralPath $backupDir -Destination $pythonDir
    } catch {
      Move-Item -LiteralPath $invalid -Destination $pythonDir
      throw
    }
    Remove-Item -LiteralPath $invalid -Recurse -Force
  } else {
    Move-Item -LiteralPath $backupDir -Destination $pythonDir
  }
  return (Test-InstalledRuntime $pythonDir $Manifest)
}

try {
  Add-Type -AssemblyName System.Net.Http
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') { throw 'Windows 10/11 x64 is required' }
  if (-not [Environment]::Is64BitOperatingSystem) { throw 'Windows x64 is required' }

  $m = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $expected = @('schema_version', 'launcher_version', 'app_identity', 'python', 'download_hosts', 'host', 'port', 'health_path', 'shutdown_path', 'start_url', 'runtime_paths')
  $actual = @($m.PSObject.Properties.Name)
  if (@(Compare-Object $expected $actual).Count -ne 0) { throw 'Runtime manifest has missing or unknown fields' }
  if ($m.python -isnot [PSCustomObject]) { throw 'Python manifest must be an object' }
  if (@(Compare-Object @('version', 'url', 'sha256', 'executable') @($m.python.PSObject.Properties.Name)).Count -ne 0) { throw 'Python manifest has missing or unknown fields' }
  if ($m.runtime_paths -isnot [PSCustomObject]) { throw 'Runtime paths must be an object' }
  if (@(Compare-Object @('root', 'python', 'logs', 'server_state') @($m.runtime_paths.PSObject.Properties.Name)).Count -ne 0) { throw 'Runtime paths have missing or unknown fields' }
  if ((($m.schema_version -isnot [int]) -and ($m.schema_version -isnot [long])) -or $m.schema_version -ne 1) { throw 'Runtime manifest schema is invalid' }
  if ($m.launcher_version -isnot [string] -or $m.launcher_version -ne '1.0.0' -or $m.app_identity -isnot [string] -or $m.app_identity -ne 'auto-offer') { throw 'Runtime manifest identity is invalid' }
  if ($m.host -isnot [string] -or $m.host -ne '127.0.0.1' -or (($m.port -isnot [int]) -and ($m.port -isnot [long])) -or $m.port -ne 8765 -or $m.start_url -isnot [string] -or $m.start_url -ne 'http://127.0.0.1:8765/#/') { throw 'Runtime manifest has an invalid fixed origin' }
  if ($m.health_path -isnot [string] -or $m.health_path -ne '/__auto_offer_health' -or $m.shutdown_path -isnot [string] -or $m.shutdown_path -ne '/__auto_offer_shutdown') { throw 'Runtime manifest lifecycle paths are invalid' }
  if ($m.runtime_paths.root -isnot [string] -or $m.runtime_paths.root -ne '.runtime' -or $m.runtime_paths.python -isnot [string] -or $m.runtime_paths.python -ne '.runtime/python' -or $m.runtime_paths.logs -isnot [string] -or $m.runtime_paths.logs -ne '.runtime/logs' -or $m.runtime_paths.server_state -isnot [string] -or $m.runtime_paths.server_state -ne '.runtime/server.json') { throw 'Runtime manifest paths are invalid' }
  if ($m.download_hosts -isnot [System.Array] -or $m.download_hosts.Count -ne 1 -or $m.download_hosts[0] -isnot [string] -or $m.download_hosts[0] -ne 'www.python.org') { throw 'Runtime manifest download hosts are invalid' }
  if ($m.python.version -isnot [string] -or -not $m.python.version -or $m.python.url -isnot [string] -or $m.python.sha256 -isnot [string] -or $m.python.executable -isnot [string] -or $m.python.executable -ne 'python.exe') { throw 'Python manifest types are invalid' }
  try { $pythonUri = [Uri]$m.python.url } catch { throw 'Runtime manifest download URL is invalid' }
  if ($pythonUri.Scheme -ne 'https' -or $pythonUri.Host -ne 'www.python.org' -or $pythonUri.UserInfo -or (-not $pythonUri.IsDefaultPort -and $pythonUri.Port -ne 443) -or $m.python.sha256 -notmatch '^[0-9a-f]{64}$') { throw 'Runtime manifest download policy is invalid' }

  $mutex = [Threading.Mutex]::new($false, 'Local\AutoOfferPortable-7d321f49')
  Write-Host '[1/4] Portable Python - waiting for preparation lock'
  try {
    $locked = $mutex.WaitOne([TimeSpan]::FromMinutes(10))
  } catch [Threading.AbandonedMutexException] {
    $locked = $true
  }
  if (-not $locked) { throw 'Timed out waiting for another launcher' }

  try {
    New-Item -ItemType Directory -Force -Path (Join-Path $runtime 'logs') | Out-Null
    $activeReady = Test-InstalledRuntime $pythonDir $m
    if (-not $activeReady -and (Test-Path -LiteralPath $pythonDir)) {
      Stop-OwnedServerForRuntimeRepair
    }
    $ready = Restore-PreviousRuntime $m

    Get-ChildItem -LiteralPath $runtime -Directory -Filter 'python-install-*' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
    if ($ready) {
      Remove-Item -LiteralPath (Join-Path $runtime 'python-download.part') -Force -ErrorAction SilentlyContinue
      Write-Host '[1/4] Portable Python - ready'
    } else {
      $drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($root).TrimEnd(':\'))
      if ($drive.Free -lt 150MB) { throw 'At least 150 MB free disk space is required' }

      $part = Join-Path $runtime 'python-download.part'
      $temp = Join-Path $runtime ('python-install-' + [guid]::NewGuid().ToString('N'))
      Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue
      Write-Host '[1/4] Portable Python - downloading verified archive'
      $downloaded = $false
      for ($attempt = 1; $attempt -le 3 -and -not $downloaded; $attempt++) {
        Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue
        $handler = New-Object Net.Http.HttpClientHandler
        $handler.AllowAutoRedirect = $false
        $client = New-Object Net.Http.HttpClient($handler)
        $uri = [Uri]$m.python.url
        try {
          for ($redirects = 0; $redirects -le 5; $redirects++) {
            if ($uri.Scheme -ne 'https' -or $m.download_hosts -notcontains $uri.Host) { throw [InvalidOperationException]::new('Forbidden download URL') }
            $response = $client.GetAsync($uri, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
            $status = [int]$response.StatusCode
            if ($status -in 301, 302, 303, 307, 308) {
              if (-not $response.Headers.Location) { throw [InvalidOperationException]::new('Redirect has no location') }
              $uri = [Uri]::new($uri, $response.Headers.Location)
              $response.Dispose()
              continue
            }
            if ($status -eq 408 -or $status -eq 429 -or $status -ge 500) {
              $response.Dispose()
              throw [Net.Http.HttpRequestException]::new("Transient HTTP status $status")
            }
            if ($status -ge 400) {
              $response.Dispose()
              throw [InvalidOperationException]::new("Non-retryable HTTP status $status")
            }
            $response.EnsureSuccessStatusCode() | Out-Null
            $total = $response.Content.Headers.ContentLength
            $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
            $out = [IO.File]::Create($part)
            $buf = New-Object byte[] 65536
            [long]$count = 0
            $started = [DateTime]::UtcNow
            try {
              while (($n = $stream.Read($buf, 0, $buf.Length)) -gt 0) {
                $out.Write($buf, 0, $n)
                $count += $n
                $elapsed = [Math]::Max(.01, ([DateTime]::UtcNow - $started).TotalSeconds)
                $speed = $count / $elapsed
                if ($null -ne $total -and $total -gt 0) {
                  Write-Progress -Activity '[1/4] Portable Python' -PercentComplete ([Math]::Min(100, 100 * $count / $total)) -Status ("{0:N1}/{1:N1} MB, {2:N1} MB/s" -f ($count / 1MB), ($total / 1MB), ($speed / 1MB))
                } else {
                  Write-Progress -Activity '[1/4] Portable Python' -Status ("Downloading... {0:N1} MB, {1:N1}s" -f ($count / 1MB), $elapsed)
                }
              }
            } finally {
              $out.Dispose()
              $stream.Dispose()
              $response.Dispose()
            }
            $downloaded = $true
            break
          }
          if (-not $downloaded) { throw [InvalidOperationException]::new('Too many redirects') }
        } catch [Net.Http.HttpRequestException] {
          if ($attempt -eq 3) { throw }
          Start-Sleep -Seconds $attempt
        } catch [IO.IOException] {
          if ($_.Exception.HResult -in -2147024784, -2147024789) { throw [InvalidOperationException]::new('Insufficient disk space', $_.Exception) }
          if ($attempt -eq 3) { throw }
          Start-Sleep -Seconds $attempt
        } catch [Net.Sockets.SocketException] {
          if ($attempt -eq 3) { throw }
          Start-Sleep -Seconds $attempt
        } catch [Threading.Tasks.TaskCanceledException] {
          if ($attempt -eq 3) { throw }
          Start-Sleep -Seconds $attempt
        } finally {
          $client.Dispose()
        }
      }

      if ((Get-Sha256 $part) -ne $m.python.sha256) { throw 'Portable Python checksum mismatch' }
      New-Item -ItemType Directory -Path $temp | Out-Null
      $zip = [IO.Compression.ZipFile]::OpenRead($part)
      try {
        if ($zip.Entries.Count -eq 0) { throw 'Portable Python ZIP is empty' }
        foreach ($entry in $zip.Entries) {
          $name = $entry.FullName.Replace('\', '/')
          if ($name.StartsWith('/') -or $name.StartsWith('//') -or $name -match '^[A-Za-z]:' -or $name.Split('/') -contains '..' -or (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw "Unsafe ZIP entry: $name" }
        }
        [IO.Compression.ZipFileExtensions]::ExtractToDirectory($zip, $temp)
      } finally {
        $zip.Dispose()
      }

      $tempPython = Join-Path $temp 'python.exe'
      if (-not (Test-Path -LiteralPath $tempPython -PathType Leaf)) { throw 'Portable Python ZIP has no python.exe' }
      $actualVersion = & $tempPython -c 'import sys; print(sys.version.split()[0])'
      if ($LASTEXITCODE -ne 0 -or $actualVersion.Trim() -ne $m.python.version) { throw 'Portable Python version check failed' }
      Write-InstallReceipt $temp $m
      if (-not (Test-InstalledRuntime $temp $m)) { throw 'Portable Python staged runtime verification failed' }

      if (Test-Path -LiteralPath $backupDir) { Remove-Item -LiteralPath $backupDir -Recurse -Force }
      $hadActive = Test-Path -LiteralPath $pythonDir
      if ($hadActive) { Move-Item -LiteralPath $pythonDir -Destination $backupDir }
      try {
        Move-Item -LiteralPath $temp -Destination $pythonDir
        if (-not (Test-InstalledRuntime $pythonDir $m)) { throw 'Published Portable Python verification failed' }
      } catch {
        $failedPublication = $null
        if (Test-Path -LiteralPath $pythonDir) {
          $failedPublication = Join-Path $runtime ('python.failed-' + [guid]::NewGuid().ToString('N'))
          Move-Item -LiteralPath $pythonDir -Destination $failedPublication
        }
        if ($hadActive -and (Test-Path -LiteralPath $backupDir)) {
          Move-Item -LiteralPath $backupDir -Destination $pythonDir
        }
        if ($failedPublication -and (Test-Path -LiteralPath $failedPublication)) {
          Remove-Item -LiteralPath $failedPublication -Recurse -Force
        }
        throw
      }
      Remove-Item -LiteralPath $part -Force
    }
  } finally {
  }

  try {
    $args = @((Join-Path $PSScriptRoot 'launcher.py'), 'start')
    if ($NoBrowser) { $args += '--no-browser' }
    & $pythonExe @args
    $launcherExit = $LASTEXITCODE
    if ($launcherExit -eq 0 -and (Test-Path -LiteralPath $backupDir)) {
      Remove-Item -LiteralPath $backupDir -Recurse -Force
    }
  } finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
  }
  exit $launcherExit
} catch {
  Fail $_.Exception.Message 'Portable Python'
  exit 2
}
