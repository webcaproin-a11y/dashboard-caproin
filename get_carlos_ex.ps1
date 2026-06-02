$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$res = $json.invoices | ForEach-Object { $_.factura } | Where-Object { 
    $_.NOMBRE_VENDEDOR -like "*CORTES*" -and 
    $_.ID_TIPO_DOC -match "EX"
}
$res | Select-Object NUMERO, SUBTOTAL, NOMBRE_TERCERO
