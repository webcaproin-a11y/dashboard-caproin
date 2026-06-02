$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$invs = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -eq '730' -or $_.NUMERO -eq '731' -or $_.NUMERO -eq '732' }
$total = 0
foreach ($inv in $invs) {
    foreach ($item in $inv.items) { $total += [double]$item.SUBTOTAL }
}
Write-Host "Total Other EX (730,731,732): $total"
