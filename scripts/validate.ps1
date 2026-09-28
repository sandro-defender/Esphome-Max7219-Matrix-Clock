<#
.SYNOPSIS
    Validate the MAX7219 matrix clock packages: tests, ESPHome config
    validation and (by default) a full ESP8266 firmware compile.

.DESCRIPTION
    Everything runs in a temporary directory that contains a copy of the
    repository files plus a generated secrets.yaml with obvious fake values.
    Your real secrets.yaml is never read, printed or modified, and only the
    temporary directory created by this script is removed afterwards.

    Steps:
      1. regression tests            (tests/test_config.py, C++ renderer tests)
      2. virtual environment         (esphome==2026.9.0, requirements-validation.txt)
      3. ESPHome config validation   (dev.yaml, local packages)
      4. full firmware compile       (dev.yaml -> ESP8266, skipped with -SkipCompile)
      5. optional remote validation  (examples/release.yaml, needs network, -Remote)

.PARAMETER Python
    Python 3.12+ interpreter used to create the virtual environment.

.PARAMETER EspHome
    Path to an existing esphome executable; skips the dependency install.

.PARAMETER SkipInstall
    Reuse the virtual environment of a previous run instead of installing.

.PARAMETER SkipCompile
    Skip the full firmware compile (config validation only).

.PARAMETER Remote
    Also validate examples/release.yaml, which downloads the pinned packages
    and fonts from GitHub. Requires network access.

.PARAMETER KeepWorkingDirectory
    Keep the temporary directory for inspection (default: remove it).

.EXAMPLE
    ./scripts/validate.ps1
.EXAMPLE
    ./scripts/validate.ps1 -SkipCompile -SkipInstall
#>
#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Python = "python",
    [string]$EspHome = "",
    [switch]$SkipInstall,
    [switch]$SkipCompile,
    [switch]$Remote,
    [switch]$KeepWorkingDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("max7219-clock-validation-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
$script:failed = 0
$script:results = New-Object System.Collections.Generic.List[string]

function Invoke-ValidationStep {
    param([string]$Name, [scriptblock]$Body)
    Write-Host ""
    Write-Host "=== $Name ===" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    try {
        & $Body
        if ($LASTEXITCODE -ne 0) { throw "step exited with code $LASTEXITCODE" }
        $script:results.Add("PASS  $Name")
    }
    catch {
        $script:results.Add("FAIL  $Name -> $($_.Exception.Message)")
        $script:failed++
    }
}

function New-FakeSecrets {
    param([string]$Path)
    # 32 zero bytes, base64 encoded: a valid *shape*, never a real key.
    $key = [Convert]::ToBase64String((New-Object byte[] 32))
    @(
        'wifi_ssid: "ValidationSSID"'
        'wifi_password: "ValidationPassword123"'
        "api_encryption_key: `"$key`""
        'fallback_ap_password: "ValidationFallback123"'
        'web_server_username: "validation"'
        'web_server_password: "ValidationWebPassword123"'
    ) | Set-Content -Path $Path -Encoding utf8
}

Write-Host "Repository : $repoRoot"
Write-Host "Working dir: $workDir"

try {
    New-Item -ItemType Directory -Path $workDir -Force | Out-Null
    foreach ($item in @("packages", "fonts", "tests", "examples", "dev.yaml", "secrets.yaml.example", "requirements-validation.txt", ".gitignore", "README.md", "VALIDATION.md")) {
        Copy-Item -LiteralPath (Join-Path $repoRoot $item) -Destination $workDir -Recurse -Force
    }
    New-FakeSecrets -Path (Join-Path $workDir "secrets.yaml")

    $venvPython = $Python
    if ($EspHome -ne "") {
        $esphome = $EspHome
    }
    elseif ($SkipInstall) {
        $venvPython = Join-Path $workDir ".venv/Scripts/python.exe"
        if (-not (Test-Path $venvPython)) { $venvPython = Join-Path $workDir ".venv/bin/python" }
        $esphome = Join-Path $workDir ".venv/Scripts/esphome.exe"
        if (-not (Test-Path $esphome)) { $esphome = Join-Path $workDir ".venv/bin/esphome" }
    }
    else {
        Invoke-ValidationStep "Create virtual environment and install esphome==2026.9.0" {
            & $Python -m venv (Join-Path $workDir ".venv")
            $venvPython = Join-Path $workDir ".venv/Scripts/python.exe"
            if (-not (Test-Path $venvPython)) { $venvPython = Join-Path $workDir ".venv/bin/python" }
            & $venvPython -m pip install --upgrade pip --quiet
            & $venvPython -m pip install --requirement (Join-Path $workDir "requirements-validation.txt") --quiet
        }
        $esphome = Join-Path $workDir ".venv/Scripts/esphome.exe"
        if (-not (Test-Path $esphome)) { $esphome = Join-Path $workDir ".venv/bin/esphome" }
    }

    Invoke-ValidationStep "Regression tests (contract + renderer)" {
        & $venvPython (Join-Path $workDir "tests/test_config.py")
    }

    Invoke-ValidationStep "ESPHome config validation (dev.yaml)" {
        Push-Location $workDir
        try { & $esphome config dev.yaml } finally { Pop-Location }
    }

    if (-not $SkipCompile) {
        Invoke-ValidationStep "Full ESP8266 firmware compile (dev.yaml)" {
            Push-Location $workDir
            try { & $esphome compile dev.yaml } finally { Pop-Location }
        }
    }
    else {
        $script:results.Add("SKIP  Full ESP8266 firmware compile (-SkipCompile)")
    }

    if ($Remote) {
        Invoke-ValidationStep "Remote release example (examples/release.yaml)" {
            Copy-Item -LiteralPath (Join-Path $workDir "examples/release.yaml") -Destination (Join-Path $workDir "max7219-clock.yaml") -Force
            Push-Location $workDir
            try { & $esphome config max7219-clock.yaml } finally { Pop-Location }
        }
    }
}
finally {
    if ($KeepWorkingDirectory) {
        Write-Host "Keeping working directory: $workDir" -ForegroundColor Yellow
    }
    elseif (Test-Path $workDir) {
        # Remove exactly the directory this script created.
        Remove-Item -LiteralPath $workDir -Recurse -Force
        Write-Host "Removed working directory: $workDir"
    }

    Write-Host ""
    Write-Host "=== Summary ===" -ForegroundColor Cyan
    foreach ($line in $script:results) {
        if ($line.StartsWith("FAIL")) { Write-Host $line -ForegroundColor Red }
        elseif ($line.StartsWith("SKIP")) { Write-Host $line -ForegroundColor Yellow }
        else { Write-Host $line -ForegroundColor Green }
    }
    Write-Host ""
    if ($script:failed -gt 0) {
        Write-Host "$script:failed step(s) failed." -ForegroundColor Red
        exit $script:failed
    }
    Write-Host "All validation steps passed." -ForegroundColor Green
    exit 0
}
