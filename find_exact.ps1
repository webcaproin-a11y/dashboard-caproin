$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$res = $json.invoices | ForEach-Object { $_.factura } | Where-Object { 
    $_.SUBTOTAL -eq 1478888 -or 
    ($_.items | Where-Object { $_.SUBTOTAL -eq 1478888 })
}
$res | Select-Object NUMERO, SUBTOTAL, NOMBRE_VENDEDOR
