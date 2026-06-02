$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$invoices = $json.invoices

$carlosInvoices = @()

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
            $subtotal = 0
            $totalVal = 0
            foreach ($i in $inv.items) {
                $subtotal += [double]$i.SUBTOTAL
                $totalVal += [double]$i.TOTAL
            }
            $carlosInvoices += [PSCustomObject]@{
                NUMERO = $num
                FECHA = $date.ToShortDateString()
                CLIENTE = $inv.NOMBRE_TERCERO
                TIPO = $inv.ID_TIPO_DOC
                SUBTOTAL = $subtotal
                TOTAL = $totalVal
            }
        }
    }
}

Write-Host "DETALLE DE VENTAS CARLOS CORTES - ABRIL 2026 (SIN AJUSTES)"
$carlosInvoices | Format-Table -AutoSize

$sumSub = ($carlosInvoices | Measure-Object SUBTOTAL -Sum).Sum
$sumTot = ($carlosInvoices | Measure-Object TOTAL -Sum).Sum

Write-Host ("TOTAL SUBTOTAL CIF: " + $sumSub)
Write-Host ("TOTAL VALOR TOTAL CIF: " + $sumTot)
