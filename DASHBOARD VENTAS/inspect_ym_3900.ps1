
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$res = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -ge 3900 -and $_.NUMERO -le 3920 -and ($_.TIPO -eq "YM" -or $_.ID_TIPO_DOC -eq "YM") }
foreach ($r in $res) {
    Write-Host "NUM: $($r.NUMERO) | VEND: $($r.NOMBRE_VENDEDOR)"
}
