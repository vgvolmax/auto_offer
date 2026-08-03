[CmdletBinding()]
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$manifestPath = Join-Path $PSScriptRoot 'runtime-manifest.json'
$runtime = Join-Path $root '.runtime'
$pythonDir = Join-Path $runtime 'python'
$pythonExe = Join-Path $pythonDir 'python.exe'
$receiptPath = Join-Path $pythonDir 'install-receipt.json'

function Fail([string]$message, [string]$stage) {
  $log = Join-Path $runtime 'logs\launcher.log'
  Write-Error "Что произошло: $message`nЭтап: $stage`nЧто сохранено: проверенные файлы release и данные IndexedDB не изменены`nСледующий start.bat повторит незавершённый этап`nЧто сделать: проверьте сеть/место и полностью распакованный ZIP`nЛог: $log"
}
try {
  Add-Type -AssemblyName System.Net.Http
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') { throw 'Windows 10/11 x64 is required' }
  if (-not [Environment]::Is64BitOperatingSystem) { throw 'Windows x64 is required' }
  $m = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $expected=@('schema_version','launcher_version','app_identity','python','download_hosts','host','port','health_path','shutdown_path','start_url','runtime_paths')
  $actual=@($m.PSObject.Properties.Name)
  if (@(Compare-Object $expected $actual).Count -ne 0) { throw 'Runtime manifest has missing or unknown fields' }
  if (@(Compare-Object @('version','url','sha256','executable') @($m.python.PSObject.Properties.Name)).Count -ne 0) { throw 'Python manifest has missing or unknown fields' }
  if ($m.host -ne '127.0.0.1' -or $m.port -ne 8765 -or $m.start_url -ne 'http://127.0.0.1:8765/#/') { throw 'Runtime manifest has an invalid fixed origin' }
  if ($m.python.url -notmatch '^https://www\.python\.org/' -or $m.python.sha256 -notmatch '^[0-9a-f]{64}$') { throw 'Runtime manifest download policy is invalid' }
  $mutex = [Threading.Mutex]::new($false, 'Local\AutoOfferPortable-7d321f49')
  Write-Host '[1/4] Portable Python - waiting for preparation lock'
  try { $locked = $mutex.WaitOne([TimeSpan]::FromMinutes(10)) }
  catch [Threading.AbandonedMutexException] { $locked = $true }
  if (-not $locked) { throw 'Timed out waiting for another launcher' }
  try {
    New-Item -ItemType Directory -Force -Path (Join-Path $runtime 'logs') | Out-Null
    $drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($root).TrimEnd(':\'))
    if ($drive.Free -lt 150MB) { throw 'At least 150 MB free disk space is required' }
    $ready = $false
    if ((Test-Path -LiteralPath $pythonExe) -and (Test-Path -LiteralPath $receiptPath)) {
      try {
        $r = Get-Content -LiteralPath $receiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $actual = & $pythonExe -c 'import sys; print(".".join(map(str, sys.version_info[:3])))'
        $ready = ($LASTEXITCODE -eq 0 -and $actual.Trim() -eq $m.python.version -and $r.python_version -eq $m.python.version -and $r.archive_sha256 -eq $m.python.sha256 -and $r.launcher_version -eq $m.launcher_version)
      } catch { $ready = $false }
    }
    if (-not $ready) {
      $part = Join-Path $runtime 'python-download.part'; $temp = Join-Path $runtime ('python-install-' + [guid]::NewGuid().ToString('N'))
      Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue
      Write-Host '[1/4] Portable Python - downloading verified archive'
      $downloaded = $false
      for ($attempt=1; $attempt -le 3 -and -not $downloaded; $attempt++) {
        Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue
        $handler = New-Object Net.Http.HttpClientHandler; $handler.AllowAutoRedirect = $false
        $client = New-Object Net.Http.HttpClient($handler); $uri = [Uri]$m.python.url
        try {
          for ($redirects=0; $redirects -le 5; $redirects++) {
            if ($uri.Scheme -ne 'https' -or $m.download_hosts -notcontains $uri.Host) { throw [InvalidOperationException]::new('Forbidden download URL') }
            $response = $client.GetAsync($uri, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
            $status = [int]$response.StatusCode
            if ($status -in 301,302,303,307,308) {
              if (-not $response.Headers.Location) { throw [InvalidOperationException]::new('Redirect has no location') }
              $uri = [Uri]::new($uri,$response.Headers.Location); $response.Dispose(); continue
            }
            if ($status -eq 408 -or $status -eq 429 -or $status -ge 500) { $response.Dispose(); throw [Net.Http.HttpRequestException]::new("Transient HTTP status $status") }
            if ($status -ge 400) { $response.Dispose(); throw [InvalidOperationException]::new("Non-retryable HTTP status $status") }
            $response.EnsureSuccessStatusCode() | Out-Null
            $total=$response.Content.Headers.ContentLength; $stream=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult(); $out=[IO.File]::Create($part); $buf=New-Object byte[] 65536; [long]$count=0; $started=[DateTime]::UtcNow
            try {
              while (($n=$stream.Read($buf,0,$buf.Length)) -gt 0) {
                $out.Write($buf,0,$n); $count += $n; $elapsed=[Math]::Max(.01,([DateTime]::UtcNow-$started).TotalSeconds); $speed=$count/$elapsed
                if ($null -ne $total -and $total -gt 0) { Write-Progress -Activity '[1/4] Portable Python' -PercentComplete ([Math]::Min(100,100*$count/$total)) -Status ("{0:N1}/{1:N1} MB, {2:N1} MB/s" -f ($count/1MB),($total/1MB),($speed/1MB)) }
                else { Write-Progress -Activity '[1/4] Portable Python' -Status ("Downloading... {0:N1} MB, {1:N1}s" -f ($count/1MB),$elapsed) }
              }
            } finally { $out.Dispose(); $stream.Dispose(); $response.Dispose() }
            $downloaded = $true; break
          }
          if (-not $downloaded) { throw [InvalidOperationException]::new('Too many redirects') }
        } catch [Net.Http.HttpRequestException] {
          if ($attempt -eq 3) { throw }
          Start-Sleep -Seconds $attempt
        } catch [IO.IOException] {
          if ($_.Exception.HResult -in -2147024784,-2147024789) { throw [InvalidOperationException]::new('Insufficient disk space', $_.Exception) }
          if ($attempt -eq 3) { throw }
          Start-Sleep -Seconds $attempt
        } catch [Net.Sockets.SocketException] {
          if ($attempt -eq 3) { throw }
          Start-Sleep -Seconds $attempt
        } catch [Threading.Tasks.TaskCanceledException] {
          if ($attempt -eq 3) { throw }
          Start-Sleep -Seconds $attempt
        } finally { $client.Dispose() }
      }
      if ((Get-FileHash -LiteralPath $part -Algorithm SHA256).Hash.ToLowerInvariant() -ne $m.python.sha256) { throw 'Portable Python checksum mismatch' }
      New-Item -ItemType Directory -Path $temp | Out-Null
      $zip=[IO.Compression.ZipFile]::OpenRead($part)
      try {
        if ($zip.Entries.Count -eq 0) { throw 'Portable Python ZIP is empty' }
        foreach ($entry in $zip.Entries) { $name=$entry.FullName.Replace('\','/'); if ($name.StartsWith('/') -or $name.StartsWith('//') -or $name -match '^[A-Za-z]:' -or $name.Split('/') -contains '..' -or (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw "Unsafe ZIP entry: $name" } }
        [IO.Compression.ZipFileExtensions]::ExtractToDirectory($zip,$temp)
      } finally { $zip.Dispose() }
      $tempPython=Join-Path $temp 'python.exe'; if (-not (Test-Path $tempPython)) { throw 'Portable Python ZIP has no python.exe' }
      $actual=& $tempPython -c 'import sys; print(".".join(map(str, sys.version_info[:3])))'; if ($LASTEXITCODE -ne 0 -or $actual.Trim() -ne $m.python.version) { throw 'Portable Python version check failed' }
      @{schema_version=1;python_version=$m.python.version;archive_sha256=$m.python.sha256;launcher_version=$m.launcher_version;installed_at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $temp 'install-receipt.json') -Encoding UTF8
      $backup=Join-Path $runtime 'python.previous'; Remove-Item $backup -Recurse -Force -ErrorAction SilentlyContinue
      if (Test-Path $pythonDir) { Move-Item $pythonDir $backup }
      try { Move-Item $temp $pythonDir } catch { if (Test-Path $backup) { Move-Item $backup $pythonDir }; throw }
      Remove-Item $backup -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item $part -Force
    } else { Write-Host '[1/4] Portable Python - ready' }
  } finally { }
  try {
    $args=@((Join-Path $PSScriptRoot 'launcher.py'),'start'); if ($NoBrowser) { $args += '--no-browser' }
    & $pythonExe @args; $launcherExit=$LASTEXITCODE
  } finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
  exit $launcherExit
} catch { Fail $_.Exception.Message 'Portable Python'; exit 2 }
