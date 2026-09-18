$ErrorActionPreference = 'Stop'
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
$names = @('AppsUseLightTheme', 'SystemUsesLightTheme')
$old = @{}
$existed = Test-Path $key
if (!$existed) { New-Item -Path $key -Force | Out-Null }
foreach ($name in $names) {
  $old[$name] = Get-ItemPropertyValue -Path $key -Name $name -ErrorAction SilentlyContinue
}
try {
  foreach ($name in $names) { New-ItemProperty -Path $key -Name $name -PropertyType DWord -Value $lampThemeValue -Force | Out-Null }
  foreach ($name in $names) { if ((Get-ItemPropertyValue -Path $key -Name $name) -ne $lampThemeValue) { throw 'Theme verification failed' } }
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LampThemeNotify {
 [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
 public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, UIntPtr wParam, string lParam, uint flags, uint timeout, out UIntPtr result);
}
'@
  $result = [UIntPtr]::Zero
  [void][LampThemeNotify]::SendMessageTimeout([IntPtr]0xffff,0x001a,[UIntPtr]::Zero,'ImmersiveColorSet',2,2000,[ref]$result)
  Write-Output 'OK'
} catch {
  foreach ($name in $names) {
    if ($null -eq $old[$name]) { Remove-ItemProperty -Path $key -Name $name -ErrorAction SilentlyContinue }
    else { New-ItemProperty -Path $key -Name $name -PropertyType DWord -Value $old[$name] -Force | Out-Null }
  }
  throw
}
