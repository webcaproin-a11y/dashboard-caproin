$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$inv = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -eq '292' }
$subtotal = 0
if ($null -ne $inv.items) {
    foreach ($i in $inv.items) { $subtotal += [double]$i.SUBTOTAL }
} else {
    $subtotal = [double]$inv.SUBTOTAL
}
Write-Host "Invoice 292 Subtotal: $subtotal"
