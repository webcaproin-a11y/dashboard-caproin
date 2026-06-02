
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$res = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.TIPO -eq "YM" } | Select-Object NUMERO, NOMBRE_VENDEDOR
$res | ConvertTo-Json
