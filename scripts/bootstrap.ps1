# For a Windows computer with no Node.js (or one that is too old). The AI runs this, never the kids:
#   powershell -ExecutionPolicy Bypass -File scripts\bootstrap.ps1
# It puts Node.js 22 inside this project (.tools\node: no admin rights needed, nothing else on the computer
# changes) and then runs the normal setup (scripts\setup.mjs) with the same options.
# With a good Node.js already on the computer it only runs the setup.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$tools = Join-Path $root '.tools'
$local = Join-Path $tools 'node'

function Test-GoodNode {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { return $false }
  try { return ([int](& node -p "process.versions.node.split('.')[0]") -ge 20) } catch { return $false }
}

function Stop-ForMentor($message) {
  Write-Output "$message NEXT, for the AI: tell the team in one sentence to ask a mentor to install Node.js 22 (nodejs.org)."
  exit 1
}

# The computer's own Node.js if it is good; else the one this script put into the project earlier.
if (-not (Test-GoodNode) -and (Test-Path (Join-Path $local 'node.exe'))) { $env:Path = "$local;$env:Path" }

if (-not (Test-GoodNode)) {
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
  $base = 'https://nodejs.org/dist/latest-v22.x'
  Write-Output 'No usable Node.js on this computer: getting Node.js 22 into this project (about 35 MB, needs the internet)...'
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $web = New-Object Net.WebClient
  try { $sums = $web.DownloadString("$base/SHASUMS256.txt") } catch { Stop-ForMentor 'Could not reach nodejs.org (no internet?).' }
  $m = [regex]::Match($sums, "([a-f0-9]{64})\s+(node-v[0-9.]+-win-$arch\.zip)")
  if (-not $m.Success) { Stop-ForMentor "No Node.js download for Windows $arch." }
  $want = $m.Groups[1].Value
  $file = $m.Groups[2].Value
  New-Item -ItemType Directory -Force -Path $tools | Out-Null
  $zip = Join-Path $tools $file
  $web.DownloadFile("$base/$file", $zip)
  if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $want) {
    Remove-Item $zip -Force
    Write-Output 'The Node.js download is damaged (wrong checksum). NEXT, for the AI: run this once more; if it fails again, ask a mentor.'
    exit 1
  }
  $unpack = Join-Path $tools 'node-unpack'
  Remove-Item $local, $unpack -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $unpack | Out-Null
  if (Get-Command tar.exe -ErrorAction SilentlyContinue) { & tar.exe -xf $zip -C $unpack } else { Expand-Archive -Path $zip -DestinationPath $unpack -Force }
  Move-Item (Get-ChildItem $unpack -Directory | Select-Object -First 1).FullName $local
  Remove-Item $unpack, $zip -Recurse -Force
  $env:Path = "$local;$env:Path"
  if (-not (Test-GoodNode)) { Stop-ForMentor 'The downloaded Node.js does not run here.' }
  Write-Output "Node.js $(& node -v) is ready inside this project."
}

& node scripts/setup.mjs @args
$code = $LASTEXITCODE
# PowerShell blocks npm's own script (npm.ps1) on many computers ("running scripts is disabled").
# Nothing on the computer is changed for that: npm.cmd does the same and is never blocked.
# (This script itself runs with "-ExecutionPolicy Bypass", so look at the computer's own settings.)
$policy = (Get-ExecutionPolicy -List | Where-Object { $_.Scope -ne 'Process' -and $_.ExecutionPolicy -ne 'Undefined' } | Select-Object -First 1).ExecutionPolicy
if (-not $policy -or "$policy" -in 'Restricted', 'AllSigned') {
  Write-Output 'For the AI: PowerShell on this computer blocks `npm`. Write `npm.cmd` instead, every time: `npm.cmd run status`, `npm.cmd run save -- "..."`.'
}
exit $code
