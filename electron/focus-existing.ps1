param([Parameter(Mandatory = $true)][string]$TargetPath)

$ErrorActionPreference = 'Stop'
$resolvedTarget = [System.IO.Path]::GetFullPath($TargetPath)

if ([System.IO.Path]::GetExtension($resolvedTarget) -ieq '.lnk') {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($resolvedTarget)
  if ($shortcut.TargetPath) { $resolvedTarget = [System.IO.Path]::GetFullPath($shortcut.TargetPath) }
}

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class HubWindowFocus {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@

$match = Get-CimInstance Win32_Process | Where-Object {
  $_.ExecutablePath -and [string]::Equals(
    [System.IO.Path]::GetFullPath($_.ExecutablePath),
    $resolvedTarget,
    [System.StringComparison]::OrdinalIgnoreCase
  )
} | ForEach-Object {
  Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
} | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1

if ($match) {
  [HubWindowFocus]::ShowWindowAsync($match.MainWindowHandle, 9) | Out-Null
  [HubWindowFocus]::SetForegroundWindow($match.MainWindowHandle) | Out-Null
  Write-Output 'FOCUSED'
} else {
  Write-Output 'NOT_FOUND'
}
