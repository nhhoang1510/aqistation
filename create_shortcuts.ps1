$WshShell = New-Object -comObject WScript.Shell

# Desktop co the nam o OneDrive
$DesktopPath = [Environment]::GetFolderPath("Desktop")
Write-Host "Desktop path: $DesktopPath"

# Shortcut cho Start
$StartShortcut = $WshShell.CreateShortcut("$DesktopPath\Khoi dong AQI.lnk")
$StartShortcut.TargetPath = "C:\Users\ADMIN\OneDrive\Desktop\btl vxl\start.bat"
$StartShortcut.WorkingDirectory = "C:\Users\ADMIN\OneDrive\Desktop\btl vxl"
$StartShortcut.Description = "Khoi dong AQI Station (Server + Dashboard)"
$StartShortcut.Save()

# Shortcut cho Stop
$StopShortcut = $WshShell.CreateShortcut("$DesktopPath\Dung AQI.lnk")
$StopShortcut.TargetPath = "C:\Users\ADMIN\OneDrive\Desktop\btl vxl\stop.bat"
$StopShortcut.WorkingDirectory = "C:\Users\ADMIN\OneDrive\Desktop\btl vxl"
$StopShortcut.Description = "Dung AQI Station"
$StopShortcut.Save()

Write-Host "Da tao shortcut tren Desktop thanh cong!" -ForegroundColor Green
