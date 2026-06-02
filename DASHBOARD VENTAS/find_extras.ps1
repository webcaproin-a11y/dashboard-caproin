
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$carlosZ1 = $json.invoices | ForEach-Object { $_.factura } | Where-Object { 
    $_.NOMBRE_VENDEDOR -like "*CORTES*" -and 
    ($_.TIPO -eq "YM" -or $_.ID_TIPO_DOC -eq "YM")
}
$targetNumbers = @("3882", "3884", "3886", "3887", "3888", "3889", "3893", "3898", "3899", "3902", "3904", "3905", "3906", "3917", "3919", "3920", "3927", "3929", "3930")

foreach ($inv in $carlosZ1) {
    if ($targetNumbers -notcontains [string]$inv.NUMERO) {
        Write-Host "EXTRA: $($inv.NUMERO) | FECHA: $($inv.FECHA) | TOTAL: $($inv.TOTAL) | CLIENTE: $($inv.NOMBRE_TERCERO)"
    }
}
