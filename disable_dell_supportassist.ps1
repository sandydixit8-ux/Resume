# Disable remaining Dell bloatware - run as admin
$services = @('Dell SupportAssist Remediation')
foreach ($s in $services) {
    try {
        Set-Service -Name $s -StartupType Disabled -ErrorAction Stop
        Stop-Service -Name $s -Force -ErrorAction SilentlyContinue
        Write-Output "[OK] $s -> Disabled"
    } catch {
        Write-Output "[FAIL] $s : $($_.Exception.Message)"
    }
}
# Also disable the remaining Dell agents/services that restart on boot
$extra = @('DellClientManagementService','SupportAssistAgent')
foreach ($s in $extra) {
    $svc = Get-Service -Name $s -ErrorAction SilentlyContinue
    if ($svc) {
        try {
            Set-Service -Name $s -StartupType Disabled -ErrorAction Stop
            Stop-Service -Name $s -Force -ErrorAction SilentlyContinue
            Write-Output "[OK] $s -> Disabled"
        } catch {
            Write-Output "[FAIL] $s (restart handles these) : $($_.Exception.Message)"
        }
    }
}
Write-Output ""
Write-Output "Done. Press Enter to close..."
Read-Host
