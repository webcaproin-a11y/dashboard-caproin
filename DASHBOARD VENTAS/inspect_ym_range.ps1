
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$res = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -ge 3880 -and $_.NUMERO -le 3930 -and $_.TIPO -eq "YM" } | Select-Object NUMERO, NOMBRE_VENDEDOR
$res | ConvertTo-Json
