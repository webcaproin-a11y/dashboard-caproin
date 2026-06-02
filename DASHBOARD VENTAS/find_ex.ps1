$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$res = $json.invoices | Where-Object { $_.TIPO -match 'EX' } | Select-Object NUMERO, TIPO, NOMBRE_TERCERO, SUBTOTAL -First 20
$res | Format-Table -AutoSize
