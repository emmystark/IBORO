; Inno Setup script -> produces a single Iboro-Setup.exe.
; MUST be compiled ON WINDOWS with Inno Setup (free): https://jrsoftware.org/isinfo.php
; Compile with: ISCC.exe iboro.iss   (or open in the Inno Setup Compiler GUI and hit Build)
;
; Two variants, same as macOS: build once with THIN=1 for a small installer
; that downloads the AI model on first run, or with THIN=0 (default) after
; populating packaging\windows\model\ (see model\README.txt) for a fully
; offline installer. Pass via: ISCC.exe /DTHIN=1 iboro.iss

#ifndef THIN
  #define THIN "0"
#endif

[Setup]
AppName=Iboro
AppVersion=1.0
DefaultDirName={localappdata}\Iboro
DefaultGroupName=Iboro
UninstallDisplayIcon={app}\app\frontend\public\next.svg
OutputBaseFilename=Iboro-Setup
OutputDir=dist
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
DisableProgramGroupPage=yes

[Files]
; The app source, minus everything huge or machine-specific to THIS build
; machine (secrets, demo data, a stale license-activation lock - see the
; comment in packaging/macos/build.sh, same reasoning applies here).
Source: "..\..\*"; DestDir: "{app}\app"; Flags: recursesubdirs createallsubdirs; \
  Excludes: "node_modules,.next,venv,chroma_db*,data,.git,packaging,*.log,backend\.env,backend\users.json,backend\conversations.json,backend\organizations.json,backend\departments.json,backend\network_access.json,backend\roles.json,backend\.license_activation.json,backend\app.db,backend\app.db-wal,backend\app.db-shm,backend\*-.json,backend\*--.json,frontend\.env.local,frontend\.env.production"
Source: "start.ps1"; DestDir: "{app}"
#if THIN == "0"
Source: "model\*"; DestDir: "{app}\model"; Flags: recursesubdirs createallsubdirs; Excludes: "README.txt"
#endif

[Icons]
Name: "{group}\Iboro"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\start.ps1"" ""{app}"""; WorkingDir: "{app}"
Name: "{commondesktop}\Iboro"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\start.ps1"" ""{app}"""; WorkingDir: "{app}"

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\start.ps1"" ""{app}"""; \
  Description: "Set up and start Iboro now"; Flags: postinstall shellexec skipifsilent
