#requires -Version 5.1
<#
.SYNOPSIS
  Dependency-free unit tests for install.ps1 architecture detection.

.DESCRIPTION
  No Pester. Two layers:

  1. The pure helper `Resolve-VinylDeckPlatform` is dot-sourced from install.ps1
     and called with PROCESSOR_ARCHITECTURE / PROCESSOR_ARCHITEW6432 set to
     every supported and rejected combination. (Windows rewrites those two
     variables for child processes, so this layer must run in-process.)
  2. install.ps1's -PrintAsset diagnostic switch is run in a child PowerShell to
     prove it reports a platform and exits before downloading anything.

  Nothing is downloaded or installed: install.ps1 is dot-sourced (which skips the
  install), the diagnostic switch returns before the download step, and
  VINYLDECK_RELEASE_BASE points at a closed local port as a guard rail.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/install-arch.tests.ps1

.EXAMPLE
  # Check another copy of the installer (used for before/after evidence).
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/install-arch.tests.ps1 -InstallerPath C:\temp\install.ps1
#>
[CmdletBinding()]
param(
    [string]$InstallerPath
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if ([string]::IsNullOrWhiteSpace($InstallerPath)) {
    $InstallerPath = Join-Path $repoRoot "install.ps1"
}
$InstallerPath = (Resolve-Path -LiteralPath $InstallerPath).Path

$archNames = @("PROCESSOR_ARCHITECTURE", "PROCESSOR_ARCHITEW6432")
$savedEnvironment = @{}
foreach ($name in $archNames) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}
$savedReleaseBase = [Environment]::GetEnvironmentVariable("VINYLDECK_RELEASE_BASE", "Process")
$savedNoPathUpdate = [Environment]::GetEnvironmentVariable("VINYLDECK_NO_PATH_UPDATE", "Process")

$script:passed = 0
$script:failed = 0

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if ($Condition) {
        $script:passed++
        Write-Host "PASS  $Message"
    }
    else {
        $script:failed++
        Write-Host "FAIL  $Message" -ForegroundColor Red
    }
}

function Set-TestArchitecture {
    param([hashtable]$Environment)

    foreach ($name in $archNames) {
        [Environment]::SetEnvironmentVariable($name, $null, "Process")
    }
    foreach ($name in $Environment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $Environment[$name], "Process")
    }
}

function Get-ResolvedPlatform {
    param([hashtable]$Environment)

    Set-TestArchitecture -Environment $Environment
    try {
        return [pscustomobject]@{ Platform = (Resolve-VinylDeckPlatform); Error = $null }
    }
    catch {
        return [pscustomobject]@{ Platform = $null; Error = $_.Exception.Message }
    }
}

try {
    # Guard rails: a regression cannot reach the network or run an installer.
    $env:VINYLDECK_RELEASE_BASE = "http://127.0.0.1:9/no-network"
    $env:VINYLDECK_NO_PATH_UPDATE = "1"

    # Dot-sourcing skips Install-VinylDeck; the helper is what we want.
    . $InstallerPath
    Write-Host "installer: $InstallerPath"
    Write-Host ""

    Assert-True ([bool](Get-Command -Name Resolve-VinylDeckPlatform -ErrorAction SilentlyContinue)) `
        "install.ps1 exposes the pure helper Resolve-VinylDeckPlatform"

    $supported = @(
        @{
            Name         = "native x64"
            Environment  = @{ PROCESSOR_ARCHITECTURE = "AMD64" }
            Architecture = "x64"
            Artifact     = "vinyldeck-setup-windows-x64.exe"
        },
        @{
            Name         = "32-bit WoW64 PowerShell on x64 Windows"
            Environment  = @{ PROCESSOR_ARCHITECTURE = "x86"; PROCESSOR_ARCHITEW6432 = "AMD64" }
            Architecture = "x64"
            Artifact     = "vinyldeck-setup-windows-x64.exe"
        },
        @{
            Name         = "native ARM64"
            Environment  = @{ PROCESSOR_ARCHITECTURE = "ARM64" }
            Architecture = "arm64"
            Artifact     = "vinyldeck-setup-windows-arm64.exe"
        },
        @{
            Name         = "32-bit WoW64 PowerShell on ARM64 Windows"
            Environment  = @{ PROCESSOR_ARCHITECTURE = "x86"; PROCESSOR_ARCHITEW6432 = "ARM64" }
            Architecture = "arm64"
            Artifact     = "vinyldeck-setup-windows-arm64.exe"
        }
    )

    foreach ($case in $supported) {
        $result = Get-ResolvedPlatform -Environment $case.Environment
        $detail = "error=<$($result.Error)>"

        Assert-True ($null -ne $result.Platform) "$($case.Name): resolves a platform ($detail)"
        if ($null -ne $result.Platform) {
            $detail = "architecture=$($result.Platform.Architecture) artifact=$($result.Platform.Artifact)"
            Assert-True ($result.Platform.Architecture -eq $case.Architecture) `
                "$($case.Name): architecture is $($case.Architecture) ($detail)"
            Assert-True ($result.Platform.Artifact -eq $case.Artifact) `
                "$($case.Name): selects $($case.Artifact) ($detail)"
            if ($case.Architecture -eq "arm64") {
                Assert-True ($result.Platform.Artifact -notmatch "x64") `
                    "$($case.Name): does not select the x64 asset ($detail)"
            }
        }
    }

    $rejected = @(
        @{
            Name        = "true 32-bit Windows"
            Environment = @{ PROCESSOR_ARCHITECTURE = "x86" }
            Error       = "32-bit Windows is not supported"
        },
        @{
            Name        = "32-bit WoW64 PowerShell on 32-bit Windows"
            Environment = @{ PROCESSOR_ARCHITECTURE = "x86"; PROCESSOR_ARCHITEW6432 = "x86" }
            Error       = "32-bit Windows is not supported"
        },
        @{
            Name        = "unsupported architecture"
            Environment = @{ PROCESSOR_ARCHITECTURE = "IA64" }
            Error       = "unsupported architecture: IA64"
        }
    )

    foreach ($case in $rejected) {
        $result = Get-ResolvedPlatform -Environment $case.Environment
        $detail = "error=<$($result.Error)>"

        Assert-True ($null -eq $result.Platform) "$($case.Name): selects no platform ($detail)"
        Assert-True ("$($result.Error)" -match [regex]::Escape($case.Error)) `
            "$($case.Name): reports `"$($case.Error)`" ($detail)"
    }

    # Child-process check of the -PrintAsset switch: it must report and stop
    # before the download step. Restore the host values first.
    foreach ($name in $archNames) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], "Process")
    }
    if ([string]::IsNullOrWhiteSpace($env:PROCESSOR_ARCHITECTURE) -and [string]::IsNullOrWhiteSpace($env:PROCESSOR_ARCHITEW6432)) {
        $env:PROCESSOR_ARCHITECTURE = "AMD64"
    }
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $InstallerPath -PrintAsset 2>&1
    $exitCode = $LASTEXITCODE
    $text = ($output | ForEach-Object { "$_" }) -join "`n"
    $detail = "exit=$exitCode output=<$text>"

    Assert-True ($exitCode -eq 0) "-PrintAsset: exit code 0 ($detail)"
    Assert-True ($text -match "(?m)^architecture=(x64|arm64)$") "-PrintAsset: reports the architecture ($detail)"
    Assert-True ($text -match "(?m)^artifact=vinyldeck-setup-windows-(x64|arm64)\.exe$") `
        "-PrintAsset: reports the release asset ($detail)"
    Assert-True ($text -notmatch "(?i)(downloading|error:)") "-PrintAsset: downloads nothing ($detail)"
}
finally {
    foreach ($name in $archNames) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], "Process")
    }
    [Environment]::SetEnvironmentVariable("VINYLDECK_RELEASE_BASE", $savedReleaseBase, "Process")
    [Environment]::SetEnvironmentVariable("VINYLDECK_NO_PATH_UPDATE", $savedNoPathUpdate, "Process")
}

Write-Host ""
Write-Host "$($script:passed) passed, $($script:failed) failed"
if ($script:failed -gt 0) {
    exit 1
}
