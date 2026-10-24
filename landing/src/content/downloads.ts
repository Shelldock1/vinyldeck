export const release = {
  version: "0.2.0",
  windows: "Windows 10 / 11 (x64)",
  linux: "Linux x64 (AppImage / deb)",
  requirement:
    "Windows needs the WebView2 runtime; Linux needs GTK 3 and WebKitGTK 4.1",
  // Stable, version-free release assets. These keep working for every tag.
  exeUrl:
    "https://github.com/Shelldock1/vinyldeck/releases/latest/download/vinyldeck-setup-windows-x64.exe",
  msiUrl:
    "https://github.com/Shelldock1/vinyldeck/releases/latest/download/vinyldeck-windows-x64.msi",
  linuxUrl:
    "https://github.com/Shelldock1/vinyldeck/releases/latest/download/vinyldeck-linux-x64.AppImage",
  linuxDebUrl:
    "https://github.com/Shelldock1/vinyldeck/releases/latest/download/vinyldeck-linux-x64.deb",
  windowsInstall:
    "irm https://github.com/Shelldock1/vinyldeck/releases/latest/download/install.ps1 | iex",
  linuxInstall:
    "curl -fsSL https://github.com/Shelldock1/vinyldeck/releases/latest/download/install.sh | bash",
  releasesUrl: "https://github.com/Shelldock1/vinyldeck/releases",
};
