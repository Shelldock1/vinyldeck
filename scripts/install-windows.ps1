<#
.SYNOPSIS
  Build and install VinylDeck for the current Windows user (no admin).

.DESCRIPTION
  Windows counterpart of scripts/install-linux.sh. Builds the release binary
  with the Tauri CLI and installs a stable copy outside the build tree:

    %LOCALAPPDATA%\Programs\VinylDeck\VinylDeck.exe
    Start Menu shortcut
    User PATH entry (only when it is missing)

  The binary is copied, not moved, so rebuilds never replace the running file.

.PARAMETER SkipBuild
  Reuse src-tauri\target\release\VinylDeck.exe instead of rebuilding.

.PARAMETER InstallRoot
  Parent directory for the app folder. Defaults to
  %LOCALAPPDATA%\Programs.

.EXAMPLE
  npm run install:windows

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-windows.ps1 -SkipBuild
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "Programs")
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$installDir = Join-Path $InstallRoot "VinylDeck"
$exeName = "VinylDeck.exe"
$releaseExe = Join-Path $repoRoot "src-tauri\target\release\$exeName"

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

Push-Location $repoRoot
try {
    if (-not $SkipBuild) {
        Write-Step "Installing npm dependencies"
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

        Write-Step "Building the release binary"
        npm run tauri build -- --no-bundle
        if ($LASTEXITCODE -ne 0) { throw "release build failed" }
    }
    else {
        Write-Step "SkipBuild: reusing the existing release binary"
    }

    if (-not (Test-Path -LiteralPath $releaseExe)) {
        throw "Release binary not found: $releaseExe. Run without -SkipBuild first."
    }

    Write-Step "Installing into $installDir"
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    Copy-Item -LiteralPath $releaseExe -Destination (Join-Path $installDir $exeName) -Force

    $installedExe = Join-Path $installDir $exeName

    # Start Menu shortcut, current user only.
    $startMenu = [Environment]::GetFolderPath("Programs")
    if ($startMenu) {
        $shortcutPath = Join-Path $startMenu "VinylDeck.lnk"
        try {
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $installedExe
            $shortcut.WorkingDirectory = $installDir
            $shortcut.IconLocation = "$installedExe,0"
            $shortcut.Description = "Cinematic vinyl player for your desktop"
            $shortcut.Save()
            Write-Step "Start Menu shortcut: $shortcutPath"
        }
        catch {
            Write-Warning "Could not create the Start Menu shortcut: $($_.Exception.Message)"
        }
    }

    # Add the app folder to the user PATH once. Never touch the machine PATH.
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($null -eq $userPath) { $userPath = "" }
    $pathEntries = $userPath.Split(";", [System.StringSplitOptions]::RemoveEmptyEntries)
    if ($pathEntries -notcontains $installDir) {
        $newPath = if ([string]::IsNullOrWhiteSpace($userPath)) {
            $installDir
        }
        else {
            "$userPath;$installDir"
        }
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        $env:Path = "$env:Path;$installDir"
        Write-Step "Added $installDir to the user PATH (open a new terminal to pick it up)"
    }
    else {
        Write-Step "$installDir is already on the user PATH"
    }

    Write-Host ""
    Write-Host "Installed:"
    Write-Host "  binary   $installedExe"
    Write-Host "  folder   $installDir"
    Write-Host "  shortcut $startMenu\VinylDeck.lnk"
    Write-Host ""
    Write-Host "Launch it from the Start Menu or run: `"$installedExe`""
}
finally {
    Pop-Location
}
