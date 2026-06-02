
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$ymInvoices = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.TIPO -eq "YM" -or $_.ID_TIPO_DOC -eq "YM" }
Write-Host "Total YM invoices: $($ymInvoices.Count)"
$groups = $ymInvoices | Group-Object NOMBRE_VENDEDOR
foreach ($g in $groups) {
    Write-Host "$($g.Name): $($g.Count)"
}
