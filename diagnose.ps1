$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$invoices = $json.invoices
$results = @()
foreach ($item in $invoices) {
    $inv = $item.factura
    if ($null -eq $inv) { $inv = $item.pedido }
    if ($null -eq $inv) { $inv = $item }
    $num = [string]$inv.NUMERO
    $fechaRaw = $inv.FECHA
    if ($null -eq $fechaRaw) { $fechaRaw = $inv.FECHA_FACTURA }
    try { $date = [DateTime]::Parse($fechaRaw) } catch { continue }
    if ($date.Year -eq 2026 -and $date.Month -eq 4) {
        $vendor = $inv.NOMBRE_VENDEDOR
        if ($vendor -like "*CORTES*" -and $vendor -like "*CARLOS*") {
            $client = $inv.NOMBRE_TERCERO
            $tipo = [string]$inv.ID_TIPO_DOC
            $subtotal = 0
            foreach ($i in $inv.items) { $subtotal += [double]$i.SUBTOTAL }
            $isEX = ($tipo -match "EX")
            if ($num -eq "729" -and $client -like "*AZUCARERA SALVADORENA*") { $isEX = $false }
            $results += [PSCustomObject]@{
                NUMERO = $num
                TIPO = if ($isEX) { "EX" } else { "CIF" }
                SUBTOTAL = $subtotal
                CLIENTE = $client
            }
        }
    }
}
Write-Host "`n--- ESTADO DASHBOARD CARLOS CORTES (ABRIL 2026) ---"
$results | Sort-Object NUMERO | Format-Table -AutoSize
$cif = ($results | Where-Object { $_.TIPO -eq "CIF" } | Measure-Object SUBTOTAL -Sum).Sum
$ex = ($results | Where-Object { $_.TIPO -eq "EX" } | Measure-Object SUBTOTAL -Sum).Sum
Write-Host "TOTAL CIF: $cif"
Write-Host "TOTAL EX:  $ex"
Write-Host "TOTAL:     $($cif + $ex)"
