
$ErrorActionPreference = "Stop"
$path = "c:\Users\ven444\OneDrive - CAPROIN\Escritorio\JUAN L CAPROIN\INFORMES DE VENTAS\DASHBOARD VENTAS\DASHBOARD VENTAS\index.html"
$uri = "file:///" + $path.Replace("\", "/")
Write-Host "Please check this URL: $uri"
