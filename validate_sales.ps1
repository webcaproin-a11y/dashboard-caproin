$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$invoices = $json.invoices

$aprilData = @()

function Normalize-Name($name) {
    if ($null -eq $name) { return "" }
    return $name.Normalize([System.Text.NormalizationForm]::FormD) -replace '\p{Mn}', '' -replace '\s+', ' ' -replace '"', '' | ForEach-Object { $_.Trim().ToUpper() }
}

function Get-ForcedZone($vendor, $apiZoneId, $destDesc) {
    $vName = Normalize-Name $vendor
    $dest = Normalize-Name $destDesc
    $zId = if ($null -ne $apiZoneId) { [string]$apiZoneId.ToString().Trim().PadLeft(2, '0') } else { "00" }
    if ($vName -like "*CAPROIN SA*" -or $vName -like "*SIN ASIGNAR*") { return "00" }
    if ($vName -like "*DIEGO*" -and $vName -like "*CAMPO*" -or $vName -like "*CORTES*" -and $vName -like "*CARLOS*") {
        if ($zId -eq "05" -or $dest -like "*CAFETERO*" -or $dest -like "*PEREIRA*" -or $dest -like "*MANIZALES*" -or $dest -like "*ARMENIA*" -or $dest -like "*DOSQUEBRADAS*") {
            return "05"
        }
        return "01"
    }
    return $zId
}

foreach ($item in $invoices) {
    $inv = $item.factura
    if ($null -eq $inv) { $inv = $item.pedido }
    if ($null -eq $inv) { $inv = $item }

    $num = [string]$inv.NUMERO
    $fechaRaw = $inv.FECHA
    if ($null -eq $fechaRaw) { $fechaRaw = $inv.FECHA_FACTURA }
    try { $date = [DateTime]::Parse($fechaRaw) } catch { continue }
    
    $client = $inv.NOMBRE_TERCERO
    $tipo = [string]$inv.TIPO
    if ($tipo -eq "") { $tipo = [string]$inv.ID_TIPO_DOC }
    
    $subtotal = 0
    if ($null -ne $inv.items) {
        foreach ($i in $inv.items) { $subtotal += [double]$i.SUBTOTAL }
    } else {
        $subtotal = [double]$inv.SUBTOTAL
    }

    $isEx = ($tipo -like "*EX*")
    $vendor = $inv.NOMBRE_VENDEDOR
    $zoneId = $inv.ID_ZONA
    $destDesc = $inv.DESCRIPCION_DESTINO

    # NEW RULE: 729, 730, 731, 732 ARE CIF
    $isCarlosExtraCIF = ($num -match "729|730|731|732") -and ($client -like "*AZUCARERA*" -or $client -like "*ERIEZ*")
    if ($isCarlosExtraCIF) {
        $isEx = $false
        $vendor = "CORTES MARTINEZ CARLOS"
        $zoneId = "01"
    }

    $forcedZone = Get-ForcedZone $vendor $zoneId $destDesc

    if ($date.Year -eq 2026 -and $date.Month -eq 4) {
        $vName = Normalize-Name $vendor
        if ($vName -like "*CORTES*" -and $vName -like "*CARLOS*") {
            $aprilData += [PSCustomObject]@{
                NUMERO = $num
                SUBTOTAL = $subtotal
                ISEX = $isEx
                ZONA = $forcedZone
            }
        }
    }
}

Write-Host "`n--- REPORTE FINAL CARLOS CORTES (729,730,731,732 AS CIF) ---"
$sumCIF = ($aprilData | Where-Object { $_.ISEX -eq $false } | Measure-Object SUBTOTAL -Sum).Sum
$sumEX = ($aprilData | Where-Object { $_.ISEX -eq $true } | Measure-Object SUBTOTAL -Sum).Sum

Write-Host "Ventas CIF: $sumCIF"
Write-Host "Ventas EX: $sumEX"
Write-Host "Total: $($sumCIF + $sumEX)"
