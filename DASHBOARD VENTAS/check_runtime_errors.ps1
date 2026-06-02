# Temporary runtime error checker using headless Edge
$ErrorActionPreference = "Stop"

$filePath = "c:\Users\ven444\OneDrive - CAPROIN\Escritorio\JUAN L CAPROIN\INFORMES DE VENTAS\DASHBOARD VENTAS\DASHBOARD VENTAS\index.html"
$backupPath = $filePath + ".bak"

# 1. Backup index.html
Copy-Item $filePath -Destination $backupPath -Force

try {
    # 2. Inject global error logger script at the beginning of <head>
    $content = Get-Content $filePath -Raw
    $errorLogger = @"
<head>
    <script>
        window.errors = [];
        window.addEventListener('error', function(e) {
            window.errors.push({
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno
            });
        });
        window.addEventListener('unhandledrejection', function(e) {
            window.errors.push({
                message: 'Unhandled Promise Rejection: ' + e.reason,
                filename: '',
                lineno: 0,
                colno: 0
            });
        });
        // Periodically write errors to a DOM element so we can extract it
        setInterval(function() {
            let div = document.getElementById('js-runtime-errors');
            if (!div) {
                div = document.createElement('div');
                div.id = 'js-runtime-errors';
                div.style.display = 'none';
                document.body.appendChild(div);
            }
            div.innerText = JSON.stringify(window.errors);
        }, 100);
    </script>
"@
    $content = $content.Replace("<head>", $errorLogger)
    Set-Content $filePath -Value $content -Force

    Write-Host "Injected error logger. Running headless Edge..."

    # 3. Run Edge headless and capture the DOM
    $uri = "file:///" + $filePath.Replace("\", "/")
    $edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    
    # We run it and redirect stdout to dump the DOM. We wait 4 seconds.
    $process = Start-Process -FilePath $edgePath -ArgumentList "--headless", "--disable-gpu", "--dump-dom", $uri -NoNewWindow -PassThru -RedirectStandardOutput "dom_dump.html"
    
    # Wait for page load and execution
    Start-Sleep -Seconds 4
    
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }

    # 4. Parse the DOM dump for #js-runtime-errors
    if (Test-Path "dom_dump.html") {
        $dom = Get-Content "dom_dump.html" -Raw
        if ($dom -match '<div id="js-runtime-errors"[^>]*>(.*?)</div>') {
            $errorsJson = $Matches[1]
            Write-Host "Found errors: $errorsJson" -ForegroundColor Red
        } else {
            Write-Host "No error container found in DOM dump. Maybe the page crashed completely or DOM did not finish loading." -ForegroundColor Yellow
        }
        Remove-Item "dom_dump.html" -Force
    } else {
        Write-Host "DOM dump file not created." -ForegroundColor Red
    }

} finally {
    # 5. Restore index.html
    if (Test-Path $backupPath) {
        Copy-Item $backupPath -Destination $filePath -Force
        Remove-Item $backupPath -Force
        Write-Host "Restored original index.html."
    }
}
