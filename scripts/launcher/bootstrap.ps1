param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$Manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$Runtime = Join-Path $Root '.runtime'
$PythonDir = Join-Path $Runtime 'python'
$Python = Join-Path $PythonDir 'python.exe'
$Downloads = Join-Path $Runtime 'downloads'
$Archive = Join-Path $Downloads 'python.zip'
New-Item -ItemType Directory -Force -Path $Downloads | Out-Null
if (-not (Test-Path -LiteralPath $Python)) {
  Write-Host '[1/7] Portable Python: download and checksum verification'
  $Part = "$Archive.part"; Remove-Item -LiteralPath $Part -Force -ErrorAction SilentlyContinue
  try {
    $ProgressPreference = 'Continue'
    Invoke-WebRequest -Uri $Manifest.python.url -OutFile $Part -UseBasicParsing
    $Actual = (Get-FileHash -LiteralPath $Part -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Actual -ne $Manifest.python.sha256) { throw "Python SHA-256 mismatch (expected $($Manifest.python.sha256), got $Actual)." }
    Move-Item -LiteralPath $Part -Destination $Archive -Force
    $Temp = "$PythonDir.new-$PID"; Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $Temp | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
      $Base = [IO.Path]::GetFullPath($Temp + [IO.Path]::DirectorySeparatorChar)
      foreach ($Entry in $Zip.Entries) {
        $Target = [IO.Path]::GetFullPath((Join-Path $Temp $Entry.FullName))
        if (-not $Target.StartsWith($Base, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe ZIP entry: $($Entry.FullName)" }
      }
    } finally { $Zip.Dispose() }
    [IO.Compression.ZipFile]::ExtractToDirectory($Archive, $Temp)
    if (-not (Test-Path -LiteralPath (Join-Path $Temp 'python.exe'))) { throw 'Invalid Python archive.' }
    if (Test-Path -LiteralPath $PythonDir) { Remove-Item -LiteralPath $PythonDir -Recurse -Force }
    Move-Item -LiteralPath $Temp -Destination $PythonDir
  } catch { Remove-Item -LiteralPath $Part -Force -ErrorAction SilentlyContinue; Write-Error $_; exit 1 }
} else { Write-Host '[1/7] Portable Python: ready' }
$LauncherArgs = @((Join-Path $PSScriptRoot 'launcher.py'), 'start')
if ($NoBrowser) { $LauncherArgs += '--no-browser' }
& $Python @LauncherArgs
exit $LASTEXITCODE
