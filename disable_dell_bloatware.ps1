# Disable Dell bloatware services - run as admin
$services = @('DDVCollectorSvcApi','DDVDataCollector','DDVRulesProcessor','DellTechHub','Dell Digital Delivery Services')
foreach ($s in $services) {
    try {
        Set-Service -Name $s -StartupType Manual -ErrorAction Stop
        Stop-Service -Name $s -Force -ErrorAction SilentlyContinue
        Write-Output "[OK] $s -> Manual & Stopped"
    } catch {
        Write-Output "[FAIL] $s : $($_.Exception.Message)"
    }
}
Write-Output ""
Write-Output "Done. Press Enter to close..."
Read-Host
