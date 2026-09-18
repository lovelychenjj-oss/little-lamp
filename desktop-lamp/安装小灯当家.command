#!/bin/bash
set -euo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
DEST_DIR="$HOME/Applications"
APP_PATH="$DEST_DIR/小灯当家.app"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp/}reading-lamp.XXXXXX")"
trap 'rm -rf -- "$BUILD_DIR"' EXIT
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo '此安装脚本需要在 Mac 上运行。'
  exit 1
fi
finish_error() {
  echo '安装未完成。请将上方错误截图发给开发者。'
  read -r -p '按回车关闭窗口…' _unused
}
trap finish_error ERR
mkdir -p "$DEST_DIR"
echo '正在使用 Mac 自带工具生成小灯当家…'
/usr/bin/osacompile -l JavaScript -s -o "$BUILD_DIR/小灯当家.app" "$ROOT_DIR/src/main.js"
RESOURCES="$BUILD_DIR/小灯当家.app/Contents/Resources"
cp -R "$ROOT_DIR/src/ui" "$RESOURCES/ui"
PLIST="$BUILD_DIR/小灯当家.app/Contents/Info.plist"
set_plist() {
  /usr/libexec/PlistBuddy -c "Set :$1 $3" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :$1 $2 $3" "$PLIST"
}
set_plist CFBundleIdentifier string com.jingjing.readinglamp.desktop
set_plist CFBundleName string '小灯当家'
set_plist CFBundleDisplayName string '小灯当家'
set_plist CFBundleShortVersionString string 0.5.6
set_plist CFBundleVersion string 16
set_plist LSUIElement bool true
set_plist LSMinimumSystemVersion string 12.0
set_plist NSAppleEventsUsageDescription string '小灯当家需要通过系统事件切换您选择的浅色或深色外观。'
# Create a local app icon using built-in image utilities.
ICONSET="$BUILD_DIR/Lamp.iconset"
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  /usr/bin/sips -z "$size" "$size" "$ROOT_DIR/assets/icon.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size*2))
  /usr/bin/sips -z "$double" "$double" "$ROOT_DIR/assets/icon.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
/usr/bin/iconutil -c icns "$ICONSET" -o "$RESOURCES/Lamp.icns"
set_plist CFBundleIconFile string Lamp.icns
# Local ad-hoc signing, not Developer ID signing or Apple notarization.
/usr/bin/codesign --force --sign - "$BUILD_DIR/小灯当家.app"
/usr/bin/codesign --verify "$BUILD_DIR/小灯当家.app"
# Keep the bundle identifier so existing preferences remain available.
/usr/bin/osascript -e 'if application id "com.jingjing.readinglamp.desktop" is running then' -e 'tell application id "com.jingjing.readinglamp.desktop" to quit' -e 'end if'
for PREVIOUS_APP in "$APP_PATH" "$DEST_DIR/Reading Lamp.app"; do
  if [[ -e "$PREVIOUS_APP" ]]; then
    BACKUP_PATH="${PREVIOUS_APP%.app}-backup-$(date +%Y%m%d-%H%M%S).app"
    mv "$PREVIOUS_APP" "$BACKUP_PATH"
    echo "旧版已保留在：$BACKUP_PATH"
  fi
done
mv "$BUILD_DIR/小灯当家.app" "$APP_PATH"
/usr/bin/open "$APP_PATH"
echo "应用文件已安装到：$APP_PATH"
echo '已发送启动请求；只有桌面出现小灯或菜单栏出现小台灯图标，才表示启动成功。'
echo '点击桌面灯底座旋钮，首次切换时允许控制 System Events（系统事件）。'
echo '关闭旧浏览器扩展，避免两套配色同时工作。'
read -r -p '按回车关闭安装窗口…' _unused
