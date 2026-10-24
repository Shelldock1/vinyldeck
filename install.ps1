# VinylDeck one-line installer for Windows x64.
#
#   irm https://github.com/Shelldock1/vinyldeck/releases/latest/download/install.ps1 | iex
#
# Downloads the NSIS setup, runs it silently for the current user, then makes
# sure the app folder is on the user PATH and a Start Menu shortcut exists.
#
# Environment overrides:
#   $env:VINYLDECK_VERSION = "v0.2.0"   install a specific release
#   $env:VINYLDECK_NO_PATH_UPDATE = "1" skip the user PATH update

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}
catch {
    # Older hosts already default to TLS 1.2+.
}

$Repo = "Shelldock1/vinyldeck"
$Artifact = "vinyldeck-setup-windows-x64.exe"

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Stop-Install([string]$Message) {
    Write-Host "error: $Message" -ForegroundColor Red
    exit 1
}

$architecture = $env:PROCESSOR_ARCHITECTURE
if ([string]::IsNullOrWhiteSpace($architecture)) {
    $architecture = (Get-CimInstance Win32_Processor | Select-Object -First 1).AddressWidth
}
if ($architecture -eq "x86" -or $architecture -eq "32") {
    Stop-Install "32-bit Windows is not supported. Use the x64 build on 64-bit Windows."
}
if ($architecture -notin @("AMD64", "ARM64", "x64", "64")) {
    Stop-Install "unsupported architecture: $architecture"
}

if ($env:VINYLDECK_VERSION) {
    $Base = "https://github.com/$Repo/releases/download/$($env:VINYLDECK_VERSION)"
}
else {
    $Base = "https://github.com/$Repo/releases/latest/download"
}
# Optional mirror/offline override (used by tests and air-gapped installs).
if ($env:VINYLDECK_RELEASE_BASE) {
    $Base = $env:VINYLDECK_RELEASE_BASE
}

$TempDir = Join-Path $env:TEMP ("vinyldeck-install-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

try {
    Write-Step "Downloading VinylDeck for Windows x64"
    $Installer = Join-Path $TempDir $Artifact
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$Base/$Artifact" -OutFile $Installer
    }
    catch {
        Stop-Install "download failed: $Base/$Artifact`n$($_.Exception.Message)"
    }

    # Verify the published checksum when it is available. The release is not
    # code-signed yet, so this only guards against a corrupt transfer.
    $Checksums = Join-Path $TempDir "SHA256SUMS.txt"
    $haveChecksums = $false
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$Base/SHA256SUMS.txt" -OutFile $Checksums
        $haveChecksums = Test-Path -LiteralPath $Checksums
    }
    catch {
        Write-Host "warning: SHA256SUMS.txt is not available for this release" -ForegroundColor Yellow
    }
    if ($haveChecksums) {
        $line = Select-String -LiteralPath $Checksums -Pattern ([regex]::Escape($Artifact) + '$') |
            Select-Object -First 1
        if ($line) {
            $expected = ($line.Line -split '\s+')[0].ToLowerInvariant()
            $actual = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($expected -ne $actual) {
                Stop-Install "checksum mismatch for $Artifact (expected $expected, got $actual)"
            }
            Write-Step "Checksum verified"
        }
    }

    Write-Step "Running the installer (current user, no admin prompt)"
    $process = Start-Process -FilePath $Installer -ArgumentList "/S" -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        Stop-Install "the installer exited with code $($process.ExitCode)."
    }

    # NSIS current-user installs land in %LOCALAPPDATA%\VinylDeck; keep the
    # other common locations for per-machine installs from earlier releases.
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "VinylDeck\VinylDeck.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\VinylDeck\VinylDeck.exe"),
        (Join-Path $env:ProgramFiles "VinylDeck\VinylDeck.exe")
    )
    if (${env:ProgramFiles(x86)}) {
        $candidates += (Join-Path ${env:ProgramFiles(x86)} "VinylDeck\VinylDeck.exe")
    }

    $Exe = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $Exe) {
        Write-Host ""
        Write-Host "VinylDeck was installed, but its executable was not found in the usual folders." -ForegroundColor Yellow
        Write-Host "Open the Start Menu and launch VinylDeck."
        exit 0
    }

    $InstallDir = Split-Path -Parent $Exe

    # Start Menu shortcut (NSIS normally creates one; repair it if it is missing).
    $startMenu = [Environment]::GetFolderPath("Programs")
    $shortcutPath = Join-Path $startMenu "VinylDeck.lnk"
    if (-not (Test-Path -LiteralPath $shortcutPath)) {
        try {
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $Exe
            $shortcut.WorkingDirectory = $InstallDir
            $shortcut.IconLocation = "$Exe,0"
            $shortcut.Description = "Cinematic vinyl player for your desktop"
            $shortcut.Save()
            Write-Step "Start Menu shortcut: $shortcutPath"
        }
        catch {
            Write-Host "warning: could not create the Start Menu shortcut: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    if ($env:VINYLDECK_NO_PATH_UPDATE -ne "1") {
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($null -eq $userPath) { $userPath = "" }
        $entries = $userPath.Split(";", [System.StringSplitOptions]::RemoveEmptyEntries)
        if ($entries -notcontains $InstallDir) {
            $newPath = if ([string]::IsNullOrWhiteSpace($userPath)) {
                $InstallDir
            }
            else {
                "$userPath;$InstallDir"
            }
            [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
            $env:Path = "$env:Path;$InstallDir"
            Write-Step "Added $InstallDir to the user PATH (open a new terminal to use it)"
        }
    }

    Write-Host ""
    Write-Host "VinylDeck is installed."
    Write-Host "  app:      $Exe"
    Write-Host "  shortcut: $shortcutPath"
    Write-Host '  launch:   Start Menu -> VinylDeck, or run "VinylDeck" in a new terminal'
    Write-Host "  note:     media metadata needs a running player (Spotify, a browser, VLC, ...)."
}
finally {
    Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}
