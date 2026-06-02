
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$ym = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.TIPO -eq "YM" }
$groups = $ym | Group-Object NOMBRE_VENDEDOR
foreach ($g in $groups) {
    Write-Host "$($g.Name): $($g.Count)"
}
