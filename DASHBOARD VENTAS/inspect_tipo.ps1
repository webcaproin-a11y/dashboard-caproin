
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$res = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -ge 3880 -and $_.NUMERO -le 3900 }
foreach ($r in $res) {
    Write-Host "NUM: $($r.NUMERO) | TIPO: '$($r.TIPO)' | ID_TIPO: '$($r.ID_TIPO_DOC)' | VEND: $($r.NOMBRE_VENDEDOR)"
}
