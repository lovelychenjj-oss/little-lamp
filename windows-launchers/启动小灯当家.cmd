@echo off
chcp 65001 >nul
set "LAMP_DIR=%~dp0小灯当家"
for %%F in ("小灯当家.exe" "icudtl.dat" "resources\app.asar" "chrome_100_percent.pak" "chrome_200_percent.pak" "v8_context_snapshot.bin" "ffmpeg.dll" "resources.pak") do (
 if not exist "%LAMP_DIR%\%%~F" (
  echo 缺少运行文件：%%~F
  echo 请重新完整解压整个压缩包。不要单独移动 exe 或这个启动文件。
  pause
  exit /b 1
 )
)
start "" /D "%LAMP_DIR%" "%LAMP_DIR%\小灯当家.exe"
