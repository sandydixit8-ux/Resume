# Reinstall keyboard drivers - run as admin
Write-Output "=== Keyboard Driver Reinstall ==="

# List current keyboard devices
Write-Output "`nCurrent keyboard devices:"
Get-PnpDevice -Class Keyboard | Format-Table Status, FriendlyName, InstanceId -AutoSize

# Remove the PS/2 internal keyboard driver (will auto-reinstall on reboot)
Write-Output "`nRemoving internal PS/2 keyboard driver..."
$ps2 = Get-PnpDevice -Class Keyboard | Where-Object { $_.InstanceId -like 'ACPI*' }
if ($ps2) {
    & pnputil /remove-device $ps2.InstanceId 2>&1
    Write-Output "Removed: $($ps2.FriendlyName)"
} else {
    Write-Output "No ACPI keyboard found - skipping"
}

# Remove HID keyboard drivers (external/USB style entries)
Write-Output "`nRemoving HID keyboard drivers..."
$hid = Get-PnpDevice -Class Keyboard | Where-Object { $_.InstanceId -like 'HID*' }
foreach ($h in $hid) {
    & pnputil /remove-device $h.InstanceId 2>&1
    Write-Output "Removed: $($h.FriendlyName)"
}

# Rescan for hardware changes to force reinstall
Write-Output "`nScanning for hardware changes..."
& pnputil /scan-devices 2>&1
Start-Sleep -Seconds 3

Write-Output "`nFinal keyboard devices:"
Get-PnpDevice -Class Keyboard | Format-Table Status, FriendlyName, InstanceId -AutoSize

Write-Output "`nReboot ke baad driver auto reinstall hoga."
Write-Output "Press Enter to close..."
Read-Host