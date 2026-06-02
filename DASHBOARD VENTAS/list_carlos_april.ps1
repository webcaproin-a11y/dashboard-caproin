$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$res = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NOMBRE_VENDEDOR -like "*CORTES*" -and $_.FECHA -like "*/04/2026*" }
$res | Select-Object NUMERO, SUBTOTAL, ID_TIPO_DOC | Sort-Object NUMERO | Format-Table -AutoSize
