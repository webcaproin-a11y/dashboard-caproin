$env:CHROME_LOG_FILE = "c:\Users\ven444\OneDrive - CAPROIN\Escritorio\JUAN L CAPROIN\INFORMES DE VENTAS\DASHBOARD VENTAS\DASHBOARD VENTAS\edge_debug.log"
if (Test-Path "edge_debug.log") {
    Remove-Item "edge_debug.log" -Force
}
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$uri = "file:///c:/Users/ven444/OneDrive - CAPROIN/Escritorio/JUAN L CAPROIN/INFORMES DE VENTAS/DASHBOARD VENTAS/DASHBOARD VENTAS/index.html"
$argList = @("--headless", "--disable-gpu", "--enable-logging", "--log-level=0", "`"$uri`"")
$proc = Start-Process -FilePath $edgePath -ArgumentList $argList -NoNewWindow -PassThru

# Give it 6 seconds to run
Start-Sleep -Seconds 6

if (-not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
}

if (Test-Path "edge_debug.log") {
    Write-Host "--- LOG CONTENT ---"
    Get-Content "edge_debug.log"
} else {
    Write-Host "No log file generated."
}
