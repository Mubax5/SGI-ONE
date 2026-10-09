# Enable only the Windows prerequisites required by the local Docker/WSL stack.
# Run through an elevated PowerShell. Never reboot automatically.
$ErrorActionPreference = 'Stop'
$sgiWorkspace = Split-Path -Parent $PSScriptRoot
$sgiArtifacts = Join-Path $sgiWorkspace 'artifacts'
$sgiStatusPath = Join-Path $sgiArtifacts 'docker-windows-setup.json'
$sgiLogPath = Join-Path $sgiArtifacts 'docker-windows-setup.log'
New-Item -ItemType Directory -Path $sgiArtifacts -Force | Out-Null
$sgiResult = [ordered]@{status='running';features=@();restartRequired=$false;wslUpdated=$false;error=$null}
function Write-SgiStatus {
    $sgiResult | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $sgiStatusPath -Encoding UTF8
}
try {
    $sgiPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $sgiPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Windows administrator approval is required to enable Docker prerequisites.'
    }
    Write-SgiStatus
    foreach ($sgiFeature in @('Microsoft-Windows-Subsystem-Linux','VirtualMachinePlatform')) {
        $sgiBefore = Get-WindowsOptionalFeature -Online -FeatureName $sgiFeature
        if ($sgiBefore.State -ne 'Enabled') {
            $sgiEnabled = Enable-WindowsOptionalFeature -Online -FeatureName $sgiFeature -All -NoRestart
            if ($sgiEnabled.RestartNeeded) { $sgiResult.restartRequired = $true }
        }
        $sgiAfter = Get-WindowsOptionalFeature -Online -FeatureName $sgiFeature
        if ($sgiAfter.State -eq 'EnablePending') { $sgiResult.restartRequired = $true }
        $sgiResult.features += @{name=$sgiFeature;before=[string]$sgiBefore.State;after=[string]$sgiAfter.State}
        Write-SgiStatus
    }
    & wsl.exe --update --web-download 2>&1 | Out-File -LiteralPath $sgiLogPath -Encoding UTF8
    if ($LASTEXITCODE -ne 0) { throw 'Microsoft WSL update failed; see artifacts/docker-windows-setup.log.' }
    $sgiResult.wslUpdated = $true
    $sgiResult.status = if ($sgiResult.restartRequired) { 'restart_required' } else { 'complete' }
    Write-SgiStatus
} catch {
    $sgiResult.status = 'failed'
    $sgiResult.error = $_.Exception.Message
    Write-SgiStatus
    exit 1
}
