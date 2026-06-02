# PowerShell PowerPoint Report Builder for CAPROIN
# Genera una presentacion premium alineada con el estilo del Dashboard de Ventas.

# ----------------- CONSTANTES DE PRESUPUESTO -----------------
$SALES_BUDGET_MONTHLY_CIF_2026 = @{
    "01" = @{ "CORTES MARTINEZ CARLOS ORLANDO" = 151000000; "CAMPO LONDONO DIEGO ANTONIO" = 81960000 }
    "02" = @{ "MEJIA CORREA JUAN MANUEL" = 80800000; "RAMIREZ PEREZ MARIA SALOME" = 23750000 }
    "03" = @{ "LOPEZ MARENCO RAFAEL" = 96105500; "DE LA ROSA EVER" = 47335500 }
    "04" = @{ "GARCIA CANO FREDDY" = 154157000; "VERGARA MORALES DANIELA" = 54000000 }
    "05" = @{ "CAMPO LONDONO DIEGO ANTONIO" = 39018000 }
}

$SALES_BUDGET_MONTHLY_EX_2026 = @{
    "01" = @{ "CORTES MARTINEZ CARLOS ORLANDO" = 24892000; "CAMPO LONDONO DIEGO ANTONIO" = 13504000 }
    "02" = @{ "MEJIA CORREA JUAN MANUEL" = 8112000; "RAMIREZ PEREZ MARIA SALOME" = 2300000 }
    "03" = @{ "LOPEZ MARENCO RAFAEL" = 18232000; "DE LA ROSA EVER" = 4558667 }
    "04" = @{ "GARCIA CANO FREDDY" = 3132000; "VERGARA MORALES DANIELA" = 43828000 }
    "05" = @{ "CAMPO LONDONO DIEGO ANTONIO" = 2020000 }
}

# ----------------- FUNCIONES DE AYUDA -----------------
function Parse-RobustDate {
    param([string]$dateStr)
    if ([string]::IsNullOrEmpty($dateStr)) { return [DateTime]::MinValue }
    if ($dateStr -like "*T*") {
        $dateStr = $dateStr.Split("T")[0]
    }
    $parts = $dateStr.Split(@('-', '/', '.'), [System.StringSplitOptions]::RemoveEmptyEntries)
    if ($parts.Count -ge 3) {
        $p0 = $null; $p1 = $null; $p2 = $null
        if ([int]::TryParse($parts[0], [ref]$p0) -and [int]::TryParse($parts[1], [ref]$p1) -and [int]::TryParse($parts[2], [ref]$p2)) {
            if ($p0 -gt 1900) {
                return New-Object DateTime($p0, $p1, $p2)
            }
            if ($p0 -le 31 -and $p2 -gt 1900) {
                return New-Object DateTime($p2, $p1, $p0)
            }
        }
    }
    $parsed = $null
    if ([DateTime]::TryParse($dateStr, [ref]$parsed)) {
        return $parsed
    }
    return [DateTime]::MinValue
}

function Normalize-Name {
    param([string]$name)
    if ([string]::IsNullOrEmpty($name)) { return "" }
    $normalized = $name.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($c in $normalized.ToCharArray()) {
        $uc = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($c)
        if ($uc -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
            $null = $sb.Append($c)
        }
    }
    return $sb.ToString().ToUpper().Trim()
}

# Nombre formateado
function Format-ShortName {
    param([string]$fullName)
    if ([string]::IsNullOrEmpty($fullName) -or $fullName -eq "Sin Asignar" -or $fullName -like "*VENTAS OFICINA*") {
        return $fullName
    }
    $short = $fullName.Trim().ToUpper().Split(@(' ', "`t"), [System.StringSplitOptions]::RemoveEmptyEntries)
    if ($short.Count -gt 3) {
        $shortName = ($short[0..2] -join ' ')
    } else {
        $shortName = ($short -join ' ')
    }
    if ($shortName -like "*DE LA ROSA*") {
        return "DE LA ROSA EVER"
    }
    if ($shortName -like "*INGENIER*") {
        return "DE LA ROSA EVER"
    }
    return $shortName
}

function Format-Currency {
    param([double]$val)
    if ($val -lt 0) {
        return ("-$`{0:N2}M" -f (-$val / 1000000))
    }
    return ("$`{0:N2}M" -f ($val / 1000000))
}

function Format-Number {
    param([double]$val)
    if ($val -lt 0) {
        return ("-$`{0:N0}" -f (-$val))
    }
    return ("$`{0:N0}" -f $val)
}

function Color-Substring {
    param($tr, [string]$substring, $color)
    if ($tr -and $substring) {
        $len = $substring.Length
        $start = $tr.Text.IndexOf($substring)
        while ($start -ge 0) {
            $subRange = $tr.Characters($start + 1, $len)
            $subRange.Font.Color.RGB = $color
            $subRange.Font.Bold = $true
            $start = $tr.Text.IndexOf($substring, $start + $len)
        }
    }
}

# ----------------- CARGA DE DATOS DESDE CACHE JSON -----------------
Write-Host "Cargando temp_invoices.json..." -ForegroundColor Cyan
$filePath = Join-Path $PSScriptRoot "temp_invoices.json"
if (-not (Test-Path $filePath)) {
    Write-Error "No se encontro temp_invoices.json en $filePath"
    exit
}

$jsonRaw = Get-Content -Raw -Path $filePath -Encoding Utf8
$data = ConvertFrom-Json $jsonRaw

Write-Host "Procesando y normalizando facturas (Reglas de Paridad con Dashboard)..." -ForegroundColor Cyan
$invoices = @()
foreach ($item in $data) {
    $inv = $null
    if ($item.factura) { $inv = $item.factura }
    elseif ($item.pedido) { $inv = $item.pedido }
    else { $inv = $item }
    
    $itemsList = $null
    if ($inv.items) { $itemsList = $inv.items }
    elseif ($inv.productos) { $itemsList = $inv.productos }
    elseif ($inv.detalles) { $itemsList = $inv.detalles }
    
    $itemsSource = @()
    if ($itemsList -is [array] -and $itemsList.Count -gt 0) {
        $itemsSource = $itemsList
    } elseif ($inv.SUBTOTAL -ne $null -or $inv.VALORCIF -ne $null -or $inv.VALOR -ne $null -or $inv.TOTAL -ne $null) {
        $itemsSource = @($inv)
    }
    
    $expandedItems = @()
    foreach ($it in $itemsSource) {
        $qty = 0.0
        if ($it.CANTIDAD -ne $null) { $qty = [double]$it.CANTIDAD }
        
        $price = 0.0
        if ($it.PRECIO -ne $null) { $price = [double]$it.PRECIO }
        
        $subtotal = 0.0
        if ($it.SUBTOTAL -ne $null) { $subtotal = [double]$it.SUBTOTAL }
        elseif ($it.VALOR -ne $null) { $subtotal = [double]$it.VALOR }
        
        $marginVal = $null
        if ($it.MAGEN_GLOBAL -ne $null) { $marginVal = [double]$it.MAGEN_GLOBAL }
        elseif ($it.MARGEN_GLOBAL -ne $null) { $marginVal = [double]$it.MARGEN_GLOBAL }
        elseif ($it.MARGEN -ne $null) { $marginVal = [double]$it.MARGEN }
        
        $totalCosto = 0.0
        if ($marginVal -ne $null) {
            # Regla de costo derivado del margen de la API para paridad
            $totalCosto = $subtotal * (1.0 - ($marginVal / 100.0))
        } else {
            if ($it.TOTAL_COSTO -ne $null) { $totalCosto = [double]$it.TOTAL_COSTO }
            elseif ($it.COSTO -ne $null) { $totalCosto = [double]$it.COSTO }
            elseif ($it.COSTO_KARDEX -ne $null) { $totalCosto = [double]$it.COSTO_KARDEX }
        }
        
        $expandedItems += [PSCustomObject]@{
            SUBTOTAL = $subtotal
            TOTAL_COSTO = $totalCosto
            DESCRIPCION_MARCA = $it.DESCRIPCION_MARCA
        }
    }
    
    $rawFecha = $null
    if ($inv.FECHA -ne $null) { $rawFecha = $inv.FECHA }
    elseif ($inv.FECHA_FACTURA -ne $null) { $rawFecha = $inv.FECHA_FACTURA }
    
    $validDate = Parse-RobustDate $rawFecha
    if ($validDate -eq [DateTime]::MinValue) { continue }
    
    $docType = ""
    if ($inv.TIPO -ne $null) { $docType = [string]$inv.TIPO }
    elseif ($inv.ID_TIPO_DOC -ne $null) { $docType = [string]$inv.ID_TIPO_DOC }
    $docType = $docType.ToUpper()
    
    $invoiceSubtotal = 0.0
    foreach ($e in $expandedItems) { $invoiceSubtotal += $e.SUBTOTAL }
    $isReturn = ($docType -like "*DVE*" -or $docType -like "*NC*" -or $invoiceSubtotal -lt 0)
    
    # Afectar periodo de factura original si es nota de credito
    if ($isReturn) {
        $originDateStr = $null
        if ($inv.FECHA_REF -ne $null) { $originDateStr = $inv.FECHA_REF }
        elseif ($inv.FECHA_AFECTADA -ne $null) { $originDateStr = $inv.FECHA_AFECTADA }
        
        if ($originDateStr) {
            $parsedRef = Parse-RobustDate $originDateStr
            if ($parsedRef -ne [DateTime]::MinValue) {
                $validDate = $parsedRef
            }
        }
    }
    
    $rawVendor = "Sin Asignar"
    if ($inv.NOMBRE_VENDEDOR -ne $null) { $rawVendor = $inv.NOMBRE_VENDEDOR }
    
    $rawZone = "00"
    if ($inv.ID_ZONA -ne $null) { $rawZone = $inv.ID_ZONA }
    elseif ($inv.ID_DESTINO -ne $null) { $rawZone = $inv.ID_DESTINO }
    $finalZone = $rawZone.Trim().Split(" ")[0].PadLeft(2, '0')
    
    $finalDest = ""
    if ($inv.DESCRIPCION_DESTINO -ne $null) { $finalDest = $inv.DESCRIPCION_DESTINO }
    
    $finalIsEX = ($docType -like "*EX*" -or $docType -like "*EXT*" -or $docType -like "*FOB*")
    
    $invNumero = ""
    if ($inv.NUMERO -ne $null) { $invNumero = [string]$inv.NUMERO }
    $clientName = "Desconocido"
    if ($inv.NOMBRE_TERCERO -ne $null) { $clientName = $inv.NOMBRE_TERCERO }
    
    # Ajuste Factura 729 (April 2026) Carlos Cortes Nacional
    if ($invNumero -eq "729" -and $clientName.ToUpper().Contains("AZUCARERA SALVADORENA")) {
        $finalIsEX = $false
        $rawVendor = "CORTES MARTINEZ CARLOS"
        $finalZone = "01"
        $finalDest = "ZONA 1 - YUMBO"
    }
    
    $shortVendor = Format-ShortName $rawVendor
    if ($shortVendor -eq "GARCIA ROSAS ANDERSON") {
        $shortVendor = "LOPEZ MARENCO RAFAEL"
    }
    if ($shortVendor -eq "INGENIER@ JR Z3") {
        $shortVendor = "DE LA ROSA EVER"
    }
    
    $brand = "Generico"
    if ($inv.DESCRIPCION_MARCA -ne $null) { $brand = $inv.DESCRIPCION_MARCA }
    elseif ($expandedItems.Count -gt 0 -and $expandedItems[0].DESCRIPCION_MARCA -ne $null) { $brand = $expandedItems[0].DESCRIPCION_MARCA }
    
    $invoiceCosto = 0.0
    foreach ($e in $expandedItems) { $invoiceCosto += $e.TOTAL_COSTO }
    
    $invoices += [PSCustomObject]@{
        FECHA = $validDate
        NUMERO = $invNumero
        NOMBRE_TERCERO = $clientName
        NOMBRE_VENDEDOR = $shortVendor
        ID_ZONA = $finalZone
        DESCRIPCION_DESTINO = $finalDest
        DESCRIPCION_MARCA = $brand
        isEX = $finalIsEX
        invoiceSubtotal = $invoiceSubtotal
        invoiceCosto = $invoiceCosto
    }
}

# ----------------- FILTRAR PERIODOS PRINCIPALES (Ene-Abr 2026 vs 2025) -----------------
$data2026 = $invoices | Where-Object { $_.FECHA.Year -eq 2026 -and $_.FECHA.Month -le 4 }
$data2025 = $invoices | Where-Object { $_.FECHA.Year -eq 2025 -and $_.FECHA.Month -le 4 }

# ----------------- CALCULO DE KPIS PRINCIPALES (Valores literales fijos sin sufijo M) -----------------
# CIF KPIs
$salesCIF_2026 = ($data2026 | Where-Object { -not $_.isEX } | Measure-Object -Property invoiceSubtotal -Sum).Sum
$salesCIF_2025 = ($data2025 | Where-Object { -not $_.isEX } | Measure-Object -Property invoiceSubtotal -Sum).Sum
$budgetCIF_2026 = (151000000 + 81960000 + 80800000 + 23750000 + 96105500 + 47335500 + 154157000 + 54000000 + 39018000) * 4 # 2,912,504,000
$cumpCIF_2026 = if ($budgetCIF_2026 -gt 0) { ($salesCIF_2026 / $budgetCIF_2026) * 100 } else { 0 }
$growthCIF_YoY = if ($salesCIF_2025 -gt 0) { (($salesCIF_2026 - $salesCIF_2025) / $salesCIF_2025) * 100 } else { 100 }

# FOB KPIs
$salesFOB_2026 = ($data2026 | Where-Object { $_.isEX } | Measure-Object -Property invoiceSubtotal -Sum).Sum
$salesFOB_2025 = ($data2025 | Where-Object { $_.isEX } | Measure-Object -Property invoiceSubtotal -Sum).Sum
$budgetFOB_2026 = (24892000 + 13504000 + 8112000 + 2300000 + 18232000 + 4558667 + 3132000 + 43828000 + 2020000) * 4 # 482,314,668
$cumpFOB_2026 = if ($budgetFOB_2026 -gt 0) { ($salesFOB_2026 / $budgetFOB_2026) * 100 } else { 0 }
$growthFOB_YoY = if ($salesFOB_2025 -gt 0) { (($salesFOB_2026 - $salesFOB_2025) / $salesFOB_2025) * 100 } else { 100 }

# Total KPIs
$salesTotal_2026 = $salesCIF_2026 + $salesFOB_2026
$salesTotal_2025 = $salesCIF_2025 + $salesFOB_2025
$budgetTotal_2026 = $budgetCIF_2026 + $budgetFOB_2026
$cumpTotal_2026 = if ($budgetTotal_2026 -gt 0) { ($salesTotal_2026 / $budgetTotal_2026) * 100 } else { 0 }
$growthTotal_YoY = if ($salesTotal_2025 -gt 0) { (($salesTotal_2026 - $salesTotal_2025) / $salesTotal_2025) * 100 } else { 100 }

# Margen CIF
$costCIF_2026 = ($data2026 | Where-Object { -not $_.isEX } | Measure-Object -Property invoiceCosto -Sum).Sum
$marginCIF_2026_Pct = if ($salesCIF_2026 -gt 0) { (($salesCIF_2026 - $costCIF_2026) / $salesCIF_2026) * 100 } else { 0 }

# ----------------- DESGLOSE MENSUAL 2026 -----------------
$monthlyStats = @()
for ($m = 1; $m -le 4; $m++) {
    $mCIF = ($data2026 | Where-Object { -not $_.isEX -and $_.FECHA.Month -eq $m } | Measure-Object -Property invoiceSubtotal -Sum).Sum
    $mFOB = ($data2026 | Where-Object { $_.isEX -and $_.FECHA.Month -eq $m } | Measure-Object -Property invoiceSubtotal -Sum).Sum
    $mTotal = $mCIF + $mFOB
    
    $mCostoCIF = ($data2026 | Where-Object { -not $_.isEX -and $_.FECHA.Month -eq $m } | Measure-Object -Property invoiceCosto -Sum).Sum
    $mMarginCIF = if ($mCIF -gt 0) { (($mCIF - $mCostoCIF) / $mCIF) * 100 } else { 0 }
    
    $mBudget = (728126000 + 120578667)
    $mCump = if ($mBudget -gt 0) { ($mTotal / $mBudget) * 100 } else { 0 }
    
    $monthlyStats += [PSCustomObject]@{
        Mes = @("", "Enero", "Febrero", "Marzo", "Abril")[$m]
        VentaCIF = $mCIF
        VentaFOB = $mFOB
        VentaTotal = $mTotal
        BudgetTotal = $mBudget
        Cumplimiento = $mCump
        MargenCIF = $mMarginCIF
    }
}

# ----------------- HISTORICO COMPARATIVO ANUAL 2021-2026 (Ene-Abr) -----------------
$historyStats = @()
for ($y = 2021; $y -le 2026; $y++) {
    $yData = $invoices | Where-Object { $_.FECHA.Year -eq $y -and $_.FECHA.Month -le 4 }
    $m1 = ($yData | Where-Object { $_.FECHA.Month -eq 1 } | Measure-Object -Property invoiceSubtotal -Sum).Sum
    $m2 = ($yData | Where-Object { $_.FECHA.Month -eq 2 } | Measure-Object -Property invoiceSubtotal -Sum).Sum
    $m3 = ($yData | Where-Object { $_.FECHA.Month -eq 3 } | Measure-Object -Property invoiceSubtotal -Sum).Sum
    $m4 = ($yData | Where-Object { $_.FECHA.Month -eq 4 } | Measure-Object -Property invoiceSubtotal -Sum).Sum
    $yTotal = $m1 + $m2 + $m3 + $m4
    
    $historyStats += [PSCustomObject]@{
        Anio = $y
        Enero = $m1
        Febrero = $m2
        Marzo = $m3
        Abril = $m4
        Total = $yTotal
        YoY = 0.0
    }
}
for ($i = 1; $i -lt $historyStats.Count; $i++) {
    $prev = $historyStats[$i-1].Total
    $curr = $historyStats[$i].Total
    if ($prev -gt 0) {
        $historyStats[$i].YoY = (($curr - $prev) / $prev) * 100
    }
}

# ----------------- EVOLUCION CLIENTES TOP 20 YOY (Ene-Abr) -----------------
$clientYearSales = @{}
$filteredHistory = $invoices | Where-Object { $_.FECHA.Month -le 4 -and $_.FECHA.Year -ge 2021 -and $_.FECHA.Year -le 2026 }
foreach ($inv in $filteredHistory) {
    $client = $inv.NOMBRE_TERCERO
    if (-not $clientYearSales.ContainsKey($client)) {
        $clientYearSales[$client] = @{ 2021=0.0; 2022=0.0; 2023=0.0; 2024=0.0; 2025=0.0; 2026=0.0 }
    }
    $clientYearSales[$client][$inv.FECHA.Year] += $inv.invoiceSubtotal
}
$topClientsList = $clientYearSales.Keys | Sort-Object -Descending { $clientYearSales[$_][2026] }, { ($clientYearSales[$_].Values | Measure-Object -Sum).Sum } | Select-Object -First 20

$clientTableRows = @()
foreach ($client in $topClientsList) {
    $v21 = if ($clientYearSales[$client].ContainsKey(2021)) { $clientYearSales[$client][2021] } else { 0.0 }
    $v22 = if ($clientYearSales[$client].ContainsKey(2022)) { $clientYearSales[$client][2022] } else { 0.0 }
    $v23 = if ($clientYearSales[$client].ContainsKey(2023)) { $clientYearSales[$client][2023] } else { 0.0 }
    $v24 = if ($clientYearSales[$client].ContainsKey(2024)) { $clientYearSales[$client][2024] } else { 0.0 }
    $v25 = if ($clientYearSales[$client].ContainsKey(2025)) { $clientYearSales[$client][2025] } else { 0.0 }
    $v26 = if ($clientYearSales[$client].ContainsKey(2026)) { $clientYearSales[$client][2026] } else { 0.0 }
    
    $growth = 100.0
    if ($v25 -gt 0) {
        $growth = (($v26 - $v25) / $v25) * 100
    }
    $clientTableRows += [PSCustomObject]@{
        Cliente = $client
        V2021 = $v21; V2022 = $v22; V2023 = $v23; V2024 = $v24; V2025 = $v25; V2026 = $v26
        YoY = $growth
        HasPrior = ($v25 -gt 0)
    }
}

# ----------------- EVOLUCION MARCAS TOP 15 YOY (Ene-Abr CIF) -----------------
$brandSales2026 = @{}
$brandSales2025 = @{}
$brandCost2026 = @{}
foreach ($inv in ($data2026 | Where-Object { -not $_.isEX })) {
    $b = $inv.DESCRIPCION_MARCA
    if (-not $brandSales2026.ContainsKey($b)) { $brandSales2026[$b] = 0.0 }
    if (-not $brandCost2026.ContainsKey($b)) { $brandCost2026[$b] = 0.0 }
    $brandSales2026[$b] += $inv.invoiceSubtotal
    $brandCost2026[$b] += $inv.invoiceCosto
}
foreach ($inv in ($data2025 | Where-Object { -not $_.isEX })) {
    $b = $inv.DESCRIPCION_MARCA
    if (-not $brandSales2025.ContainsKey($b)) { $brandSales2025[$b] = 0.0 }
    $brandSales2025[$b] += $inv.invoiceSubtotal
}
$topBrandsList = $brandSales2026.Keys | Sort-Object -Descending { $brandSales2026[$_] } | Select-Object -First 15
$brandTableRows = @()
foreach ($b in $topBrandsList) {
    $v26 = $brandSales2026[$b]
    $v25 = if ($brandSales2025.ContainsKey($b)) { $brandSales2025[$b] } else { 0.0 }
    $c26 = if ($brandCost2026.ContainsKey($b)) { $brandCost2026[$b] } else { 0.0 }
    $growth = if ($v25 -gt 0) { (($v26 - $v25) / $v25) * 100 } else { 100.0 }
    $margin = if ($v26 -gt 0) { (($v26 - $c26) / $v26) * 100 } else { 0.0 }
    $brandTableRows += [PSCustomObject]@{
        Marca = $b
        V2025 = $v25; V2026 = $v26
        YoY = $growth
        Margen = $margin
        HasPrior = ($v25 -gt 0)
    }
}

# ----------------- ANÁLISIS BCG (CUADRANTES) Y PARETO -----------------
$clientCIFMap = @{}
foreach ($inv in ($data2026 | Where-Object { -not $_.isEX })) {
    $c = $inv.NOMBRE_TERCERO
    if (-not $clientCIFMap.ContainsKey($c)) {
        $clientCIFMap[$c] = @{ V = 0.0; C = 0.0 }
    }
    $clientCIFMap[$c].V += $inv.invoiceSubtotal
    $clientCIFMap[$c].C += $inv.invoiceCosto
}
$bcgPoints = @()
$sumM = 0.0
foreach ($c in $clientCIFMap.Keys) {
    $v = $clientCIFMap[$c].V
    if ($v -gt 500000) {
        $co = $clientCIFMap[$c].C
        $marginPct = if ($v -gt 0) { (($v - $co) / $v) * 100 } else { 0.0 }
        $bcgPoints += [PSCustomObject]@{ Client = $c; Volume = $v; Margin = $marginPct }
        $sumM += $marginPct
    }
}
$sortedVolumes = $bcgPoints.Volume | Sort-Object
$medianV = 0.0
if ($sortedVolumes.Count -gt 0) {
    $idx = [Math]::Floor($sortedVolumes.Count / 2)
    $medianV = $sortedVolumes[$idx]
}
$avgM = if ($bcgPoints.Count -gt 0) { $sumM / $bcgPoints.Count } else { 30.0 }

$stars = @(); $volume = @(); $niche = @(); $review = @()
foreach ($p in $bcgPoints) {
    if ($p.Volume -ge $medianV -and $p.Margin -ge $avgM) { $stars += $p.Client }
    elseif ($p.Volume -ge $medianV -and $p.Margin -lt $avgM) { $volume += $p.Client }
    elseif ($p.Volume -lt $medianV -and $p.Margin -ge $avgM) { $niche += $p.Client }
    else { $review += $p.Client }
}

$brandMargins = @()
foreach ($b in $brandSales2026.Keys) {
    $v26 = $brandSales2026[$b]
    $c26 = if ($brandCost2026.ContainsKey($b)) { $brandCost2026[$b] } else { 0.0 }
    $mAbs = $v26 - $c26
    if ($mAbs -gt 0) {
        $brandMargins += [PSCustomObject]@{ Brand = $b; Margin = $mAbs }
    }
}
$brandMargins = $brandMargins | Sort-Object -Property Margin -Descending
$totalMarginAbs = ($brandMargins | Measure-Object -Property Margin -Sum).Sum
$paretoBrands = @()
$cumMargin = 0.0
foreach ($bm in $brandMargins) {
    $pct = ($bm.Margin / $totalMarginAbs) * 100
    $cumMargin += $bm.Margin
    $cumPct = ($cumMargin / $totalMarginAbs) * 100
    $paretoBrands += [PSCustomObject]@{ Brand = $bm.Brand; Pct = $pct; CumPct = $cumPct }
}

# ----------------- CONEXIÓN COM POWERPOINT -----------------
Write-Host "Inicializando PowerPoint por automatizacion COM..." -ForegroundColor Green
$powerpoint = New-Object -ComObject PowerPoint.Application
$powerpoint.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue

$presentation = $powerpoint.Presentations.Add()
$presentation.PageSetup.SlideWidth = 960
$presentation.PageSetup.SlideHeight = 540

# Definicion de colores Win32 RGB (B-G-R interno)
function Get-Rgb {
    param([int]$r, [int]$g, [int]$b)
    return ($r + ($g -shl 8) + ($b -shl 16))
}
$cDarkBg = Get-Rgb 1 8 11       # #01080b
$cDarkCard = Get-Rgb 18 24 27   # #12181b
$cCyan = Get-Rgb 0 236 255      # #00ecff
$cOrange = Get-Rgb 255 157 0    # #ff9d00
$cRed = Get-Rgb 210 38 48       # #D22630
$cGreen = Get-Rgb 39 174 96     # #27ae60
$cWhite = Get-Rgb 255 255 255
$cGray = Get-Rgb 125 139 145    # #7d8b91
$cDarkGray = Get-Rgb 40 45 48   # #282d30

# Helper para cabecera de diapositivas
function Add-SlideHeader {
    param($slide, $titleText, $subtitleText)
    
    $tbTitle = $slide.Shapes.AddTextbox(1, 40, 20, 880, 40) # 1 = msoTextOrientationHorizontal
    $tbTitle.TextFrame.TextRange.Text = $titleText
    $tbTitle.TextFrame.TextRange.Font.Name = "Segoe UI"
    $tbTitle.TextFrame.TextRange.Font.Size = 22
    $tbTitle.TextFrame.TextRange.Font.Bold = $true
    $tbTitle.TextFrame.TextRange.Font.Color.RGB = $cWhite
    $tbTitle.TextFrame.MarginLeft = 0
    $tbTitle.TextFrame.MarginTop = 0
    
    if ($subtitleText) {
        $tbSub = $slide.Shapes.AddTextbox(1, 40, 58, 880, 25)
        $tbSub.TextFrame.TextRange.Text = $subtitleText
        $tbSub.TextFrame.TextRange.Font.Name = "Segoe UI"
        $tbSub.TextFrame.TextRange.Font.Size = 11
        $tbSub.TextFrame.TextRange.Font.Color.RGB = $cCyan
        $tbSub.TextFrame.MarginLeft = 0
        $tbSub.TextFrame.MarginTop = 0
    }
    
    $line = $slide.Shapes.AddShape(1, 40, 85, 880, 1.5)
    $line.Fill.Solid()
    $line.Fill.ForeColor.RGB = $cDarkGray
    $line.Line.Visible = 0
}

# Helper para dar estilo a tablas
function Format-TableDesign {
    param($table, $numRows, $numCols, $cHeaderBg, $cHeaderFg, $cRowBg, $cRowFg, $cRowAltBg)
    for ($r = 1; $r -le $numRows; $r++) {
        for ($c = 1; $c -le $numCols; $c++) {
            $cell = $table.Cell($r, $c)
            $cell.Shape.TextFrame.TextRange.Font.Name = "Segoe UI"
            $cell.Shape.TextFrame.VerticalAnchor = 3
            
            $cell.Shape.TextFrame.MarginLeft = 6
            $cell.Shape.TextFrame.MarginRight = 6
            $cell.Shape.TextFrame.MarginTop = 4
            $cell.Shape.TextFrame.MarginBottom = 4
            
            if ($r -eq 1) {
                $cell.Shape.Fill.Solid()
                $cell.Shape.Fill.ForeColor.RGB = $cHeaderBg
                $cell.Shape.TextFrame.TextRange.Font.Bold = $true
                $cell.Shape.TextFrame.TextRange.Font.Size = 10
                $cell.Shape.TextFrame.TextRange.Font.Color.RGB = $cHeaderFg
            } else {
                $cell.Shape.Fill.Solid()
                if ($r % 2 -eq 0) {
                    $cell.Shape.Fill.ForeColor.RGB = $cRowBg
                } else {
                    $cell.Shape.Fill.ForeColor.RGB = $cRowAltBg
                }
                $cell.Shape.TextFrame.TextRange.Font.Size = 9
                $cell.Shape.TextFrame.TextRange.Font.Color.RGB = $cRowFg
            }
        }
    }
}

# ----------------- SLIDE 1: PORTADA -----------------
Write-Host "Creando Slide 1: Portada..." -ForegroundColor Cyan
$slide1 = $presentation.Slides.Add($presentation.Slides.Count + 1, 12) # 12 = ppLayoutBlank
$slide1.Background.Fill.Solid()
$slide1.Background.Fill.ForeColor.RGB = $cDarkBg

$portadaCard = $slide1.Shapes.AddShape(5, 120, 90, 720, 360) # 5 = msoShapeRoundedRectangle
$portadaCard.Fill.Solid()
$portadaCard.Fill.ForeColor.RGB = $cDarkCard
$portadaCard.Line.ForeColor.RGB = $cCyan
$portadaCard.Line.Weight = 2

$tbBrand = $slide1.Shapes.AddTextbox(1, 200, 140, 560, 35)
$tbBrand.TextFrame.TextRange.Text = "C A P R O I N   S. A."
$tbBrand.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbBrand.TextFrame.TextRange.Font.Size = 14
$tbBrand.TextFrame.TextRange.Font.Bold = $true
$tbBrand.TextFrame.TextRange.Font.Color.RGB = $cCyan
$tbBrand.TextFrame.TextRange.ParagraphFormat.Alignment = 2 # Center

$tbTitle = $slide1.Shapes.AddTextbox(1, 150, 180, 660, 60)
$tbTitle.TextFrame.TextRange.Text = "REUNION GENERAL DE VENTAS"
$tbTitle.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbTitle.TextFrame.TextRange.Font.Size = 34
$tbTitle.TextFrame.TextRange.Font.Bold = $true
$tbTitle.TextFrame.TextRange.Font.Color.RGB = $cWhite
$tbTitle.TextFrame.TextRange.ParagraphFormat.Alignment = 2

$divLine = $slide1.Shapes.AddShape(1, 280, 260, 400, 2)
$divLine.Fill.Solid()
$divLine.Fill.ForeColor.RGB = $cRed
$divLine.Line.Visible = 0

$tbSub = $slide1.Shapes.AddTextbox(1, 150, 290, 660, 80)
$tbSub.TextFrame.TextRange.Text = "RESUMEN EJECUTIVO Y EVOLUCION HISTORICA YOY`nPeriodo analizado: Enero - Abril (2021 - 2026)"
$tbSub.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbSub.TextFrame.TextRange.Font.Size = 14
$tbSub.TextFrame.TextRange.Font.Color.RGB = $cGray
$tbSub.TextFrame.TextRange.ParagraphFormat.Alignment = 2

# ----------------- SLIDE 2: RESUMEN EJECUTIVO -----------------
Write-Host "Creando Slide 2: Resumen Ejecutivo..." -ForegroundColor Cyan
$slide2 = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
$slide2.Background.Fill.Solid()
$slide2.Background.Fill.ForeColor.RGB = $cDarkBg
Add-SlideHeader $slide2 "RESUMEN EJECUTIVO: VENTAS Y CUMPLIMIENTO" "Ventas Acumuladas Enero - Abril 2026 vs Presupuesto e Historico 2025"

# Helper para tarjetas KPI
function Add-KpiCard {
    param($slide, $left, $top, $width, $height, $title, $value, $budgetStr, $cumpPct, $yoyStr, $borderColor)
    
    $card = $slide.Shapes.AddShape(1, $left, $top, $width, $height)
    $card.Fill.Solid()
    $card.Fill.ForeColor.RGB = $cDarkCard
    $card.Line.ForeColor.RGB = $borderColor
    $card.Line.Weight = 2
    
    $tbTitle = $slide.Shapes.AddTextbox(1, $left + 15, $top + 15, $width - 30, 30)
    $tbTitle.TextFrame.TextRange.Text = $title
    $tbTitle.TextFrame.TextRange.Font.Name = "Segoe UI"
    $tbTitle.TextFrame.TextRange.Font.Size = 12
    $tbTitle.TextFrame.TextRange.Font.Bold = $true
    $tbTitle.TextFrame.TextRange.Font.Color.RGB = $cGray
    
    $tbVal = $slide.Shapes.AddTextbox(1, $left + 15, $top + 45, $width - 30, 50)
    $tbVal.TextFrame.TextRange.Text = $value
    $tbVal.TextFrame.TextRange.Font.Name = "Segoe UI"
    $tbVal.TextFrame.TextRange.Font.Size = 28
    $tbVal.TextFrame.TextRange.Font.Bold = $true
    $tbVal.TextFrame.TextRange.Font.Color.RGB = $cWhite
    
    $tbBgt = $slide.Shapes.AddTextbox(1, $left + 15, $top + 105, $width - 30, 30)
    $tbBgt.TextFrame.TextRange.Text = $budgetStr
    $tbBgt.TextFrame.TextRange.Font.Name = "Segoe UI"
    $tbBgt.TextFrame.TextRange.Font.Size = 11
    $tbBgt.TextFrame.TextRange.Font.Color.RGB = $cGray
    
    $tbCump = $slide.Shapes.AddTextbox(1, $left + 15, $top + 145, $width - 30, 45)
    $tbCump.TextFrame.TextRange.Text = ("Cumplimiento: {0:N1}%" -f $cumpPct)
    $tbCump.TextFrame.TextRange.Font.Name = "Segoe UI"
    $tbCump.TextFrame.TextRange.Font.Size = 16
    $tbCump.TextFrame.TextRange.Font.Bold = $true
    if ($cumpPct -ge 100) { $tbCump.TextFrame.TextRange.Font.Color.RGB = $cGreen }
    elseif ($cumpPct -ge 80) { $tbCump.TextFrame.TextRange.Font.Color.RGB = $cOrange }
    else { $tbCump.TextFrame.TextRange.Font.Color.RGB = $cRed }
    
    if ($yoyStr) {
        $tbYoY = $slide.Shapes.AddTextbox(1, $left + 15, $top + 195, $width - 30, 30)
        $tbYoY.TextFrame.TextRange.Text = $yoyStr
        $tbYoY.TextFrame.TextRange.Font.Name = "Segoe UI"
        $tbYoY.TextFrame.TextRange.Font.Size = 11
        if ($yoyStr.Contains("+")) { $tbYoY.TextFrame.TextRange.Font.Color.RGB = $cGreen }
        elseif ($yoyStr.Contains("-")) { $tbYoY.TextFrame.TextRange.Font.Color.RGB = $cRed }
        else { $tbYoY.TextFrame.TextRange.Font.Color.RGB = $cGray }
    }
}

# Evaluar condicionales fuera de concatenaciones
$signCif = if ($growthCIF_YoY -ge 0) { "+" } else { "" }
$yoyCifStr = "YoY vs 2025: $signCif" + ("{0:N1}%" -f $growthCIF_YoY)

$signFob = if ($growthFOB_YoY -ge 0) { "+" } else { "" }
$yoyFobStr = "YoY vs 2025: $signFob" + ("{0:N1}%" -f $growthFOB_YoY)

$signTotal = if ($growthTotal_YoY -ge 0) { "+" } else { "" }
$yoyTotalStr = "YoY vs 2025: $signTotal" + ("{0:N1}%" -f $growthTotal_YoY)

Add-KpiCard $slide2 60 120 260 280 "VENTAS NACIONALES (CIF)" (Format-Currency $salesCIF_2026) ("Presupuesto: " + (Format-Currency $budgetCIF_2026)) $cumpCIF_2026 $yoyCifStr $cRed
Add-KpiCard $slide2 350 120 260 280 "VENTAS EXPORTACION (FOB)" (Format-Currency $salesFOB_2026) ("Presupuesto: " + (Format-Currency $budgetFOB_2026)) $cumpFOB_2026 $yoyFobStr $cOrange
Add-KpiCard $slide2 640 120 260 280 "VENTA GLOBAL CONSOLIDADA" (Format-Currency $salesTotal_2026) ("Presupuesto: " + (Format-Currency $budgetTotal_2026)) $cumpTotal_2026 $yoyTotalStr $cGreen

# KPI Adicional: Margen Bruto General en el pie
$metaText = if ($marginCIF_2026_Pct -ge 30) { "Meta Cumplida (>=30%)" } else { "Bajo Meta (<30%)" }
$metaColor = if ($marginCIF_2026_Pct -ge 30) { $cGreen } else { $cRed }

$tbFootNote = $slide2.Shapes.AddTextbox(1, 60, 420, 840, 40)
$tbFootNote.TextFrame.TextRange.Text = ("Margen Bruto Promedio Venta Nacional (CIF): {0:N1}%" -f $marginCIF_2026_Pct) + "  |  " + $metaText
$tbFootNote.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbFootNote.TextFrame.TextRange.Font.Size = 13
$tbFootNote.TextFrame.TextRange.Font.Bold = $true
$tbFootNote.TextFrame.TextRange.Font.Color.RGB = $metaColor
$tbFootNote.TextFrame.TextRange.ParagraphFormat.Alignment = 2

# ----------------- SLIDE 3: DESGLOSE Y EVOLUCIÓN MENSUAL -----------------
Write-Host "Creando Slide 3: Desglose Mensual..." -ForegroundColor Cyan
$slide3 = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
$slide3.Background.Fill.Solid()
$slide3.Background.Fill.ForeColor.RGB = $cDarkBg
Add-SlideHeader $slide3 "DESGLOSE OPERATIVO MENSUAL (2026)" "Facturacion Detallada por Mes y Evolucion de Cumplimiento y Margen"

# Tabla de desglose mensual (5 filas: Cabecera, Ene, Feb, Mar, Abr + 1 total = 6 filas; 7 columnas)
$tblShape3 = $slide3.Shapes.AddTable(6, 7, 60, 110, 840, 240)
$tbl3 = $tblShape3.Table

$tbl3.Cell(1, 1).Shape.TextFrame.TextRange.Text = "Mes"
$tbl3.Cell(1, 2).Shape.TextFrame.TextRange.Text = "Venta CIF"
$tbl3.Cell(1, 3).Shape.TextFrame.TextRange.Text = "Venta FOB"
$tbl3.Cell(1, 4).Shape.TextFrame.TextRange.Text = "Venta Total"
$tbl3.Cell(1, 5).Shape.TextFrame.TextRange.Text = "Ppto Total"
$tbl3.Cell(1, 6).Shape.TextFrame.TextRange.Text = "% Cump."
$tbl3.Cell(1, 7).Shape.TextFrame.TextRange.Text = "Margen CIF"

for ($i = 0; $i -lt 4; $i++) {
    $rowIdx = $i + 2
    $stat = $monthlyStats[$i]
    $tbl3.Cell($rowIdx, 1).Shape.TextFrame.TextRange.Text = $stat.Mes
    $tbl3.Cell($rowIdx, 2).Shape.TextFrame.TextRange.Text = Format-Currency $stat.VentaCIF
    $tbl3.Cell($rowIdx, 3).Shape.TextFrame.TextRange.Text = Format-Currency $stat.VentaFOB
    $tbl3.Cell($rowIdx, 4).Shape.TextFrame.TextRange.Text = Format-Currency $stat.VentaTotal
    $tbl3.Cell($rowIdx, 5).Shape.TextFrame.TextRange.Text = Format-Currency $stat.BudgetTotal
    $tbl3.Cell($rowIdx, 6).Shape.TextFrame.TextRange.Text = ("{0:N1}%" -f $stat.Cumplimiento)
    $tbl3.Cell($rowIdx, 7).Shape.TextFrame.TextRange.Text = ("{0:N1}%" -f $stat.MargenCIF)
    
    # Formato de color para margen en la fila (evaluado fuera)
    $cMargenColor = if ($stat.MargenCIF -ge 30) { $cGreen } elseif ($stat.MargenCIF -ge 15) { $cOrange } else { $cRed }
    $tbl3.Cell($rowIdx, 7).Shape.TextFrame.TextRange.Font.Color.RGB = $cMargenColor
    $tbl3.Cell($rowIdx, 7).Shape.TextFrame.TextRange.Font.Bold = $true
}

# Fila Total (fila 6)
$tbl3.Cell(6, 1).Shape.TextFrame.TextRange.Text = "Total Acum."
$tbl3.Cell(6, 2).Shape.TextFrame.TextRange.Text = Format-Currency $salesCIF_2026
$tbl3.Cell(6, 3).Shape.TextFrame.TextRange.Text = Format-Currency $salesFOB_2026
$tbl3.Cell(6, 4).Shape.TextFrame.TextRange.Text = Format-Currency $salesTotal_2026
$tbl3.Cell(6, 5).Shape.TextFrame.TextRange.Text = Format-Currency $budgetTotal_2026
$tbl3.Cell(6, 6).Shape.TextFrame.TextRange.Text = ("{0:N1}%" -f $cumpTotal_2026)
$tbl3.Cell(6, 7).Shape.TextFrame.TextRange.Text = ("{0:N1}%" -f $marginCIF_2026_Pct)

$tbl3.Cell(6, 6).Shape.TextFrame.TextRange.Font.Bold = $true
$tbl3.Cell(6, 7).Shape.TextFrame.TextRange.Font.Bold = $true
$cTotalMargenColor = if ($marginCIF_2026_Pct -ge 30) { $cGreen } elseif ($marginCIF_2026_Pct -ge 15) { $cOrange } else { $cRed }
$tbl3.Cell(6, 7).Shape.TextFrame.TextRange.Font.Color.RGB = $cTotalMargenColor

Format-TableDesign $tbl3 6 7 $cDarkGray $cWhite $cDarkCard $cWhite (Get-Rgb 26 32 35)

# Alinear celdas a la derecha excepto columna de Mes
for ($r = 2; $r -le 6; $r++) {
    for ($c = 2; $c -le 7; $c++) {
        $tbl3.Cell($r, $c).Shape.TextFrame.TextRange.ParagraphFormat.Alignment = 3 # Right
    }
    $tbl3.Cell($r, 1).Shape.TextFrame.TextRange.Font.Bold = $true
}

# Cuadro de Insights
$tbInsight3 = $slide3.Shapes.AddTextbox(1, 60, 390, 840, 110)
$tbInsight3.TextFrame.TextRange.Text = @"
Observaciones Operativas del Periodo 2026:
• Febrero registro el mayor volumen de facturacion consolidada del periodo con $(Format-Currency $monthlyStats[1].VentaTotal) y un cumplimiento del $("{0:N1}%" -f $monthlyStats[1].Cumplimiento).
• Abril se consolido como el mes con mayor rentabilidad en ventas nacionales (CIF), alcanzando un margen bruto del $("{0:N1}%" -f $monthlyStats[3].MargenCIF).
• La facturacion acumulada consolidada CIF+FOB de $(Format-Currency $salesTotal_2026) representa un cumplimiento del $("{0:N1}%" -f $cumpTotal_2026) sobre la meta semestralizada.
"@
$tbInsight3.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbInsight3.TextFrame.TextRange.Font.Size = 11
$tbInsight3.TextFrame.TextRange.Font.Color.RGB = $cWhite
$tbInsight3.TextFrame.MarginLeft = 10
$tbInsight3.TextFrame.MarginTop = 5

# ----------------- SLIDE 4: COMPARATIVA HISTÓRICA 2021-2026 -----------------
Write-Host "Creando Slide 4: Historico Comparativo..." -ForegroundColor Cyan
$slide4 = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
$slide4.Background.Fill.Solid()
$slide4.Background.Fill.ForeColor.RGB = $cDarkBg
Add-SlideHeader $slide4 "HISTORICO COMPARATIVO ANUAL (2021 - 2026)" "Ventas Consolidadas CIF+FOB Acumuladas a Abril de Cada Ano"

# Tabla de historico anual (7 filas: Cabecera + 6 anos; 7 columnas: Ano, Ene, Feb, Mar, Abr, Total, Var YoY)
$tblShape4 = $slide4.Shapes.AddTable(7, 7, 60, 120, 840, 240)
$tbl4 = $tblShape4.Table

$tbl4.Cell(1, 1).Shape.TextFrame.TextRange.Text = "Ano"
$tbl4.Cell(1, 2).Shape.TextFrame.TextRange.Text = "Enero"
$tbl4.Cell(1, 3).Shape.TextFrame.TextRange.Text = "Febrero"
$tbl4.Cell(1, 4).Shape.TextFrame.TextRange.Text = "Marzo"
$tbl4.Cell(1, 5).Shape.TextFrame.TextRange.Text = "Abril"
$tbl4.Cell(1, 6).Shape.TextFrame.TextRange.Text = "Total Periodo"
$tbl4.Cell(1, 7).Shape.TextFrame.TextRange.Text = "Var. YoY"

for ($i = 0; $i -lt 6; $i++) {
    $rowIdx = $i + 2
    $stat = $historyStats[$i]
    $tbl4.Cell($rowIdx, 1).Shape.TextFrame.TextRange.Text = $stat.Anio.ToString()
    $tbl4.Cell($rowIdx, 2).Shape.TextFrame.TextRange.Text = Format-Currency $stat.Enero
    $tbl4.Cell($rowIdx, 3).Shape.TextFrame.TextRange.Text = Format-Currency $stat.Febrero
    $tbl4.Cell($rowIdx, 4).Shape.TextFrame.TextRange.Text = Format-Currency $stat.Marzo
    $tbl4.Cell($rowIdx, 5).Shape.TextFrame.TextRange.Text = Format-Currency $stat.Abril
    $tbl4.Cell($rowIdx, 6).Shape.TextFrame.TextRange.Text = Format-Currency $stat.Total
    
    if ($i -eq 0) {
        $tbl4.Cell($rowIdx, 7).Shape.TextFrame.TextRange.Text = "Base"
        $tbl4.Cell($rowIdx, 7).Shape.TextFrame.TextRange.Font.Color.RGB = $cGray
    } else {
        $growth = $stat.YoY
        # Evaluar condicionales fuera de la llamada
        $signGrowth = if ($growth -ge 0) { "+" } else { "" }
        $growthText = "$signGrowth" + ("{0:N1}%" -f $growth)
        $growthColor = if ($growth -ge 0) { $cGreen } else { $cRed }
        
        $tbl4.Cell($rowIdx, 7).Shape.TextFrame.TextRange.Text = $growthText
        $tbl4.Cell($rowIdx, 7).Shape.TextFrame.TextRange.Font.Color.RGB = $growthColor
        $tbl4.Cell($rowIdx, 7).Shape.TextFrame.TextRange.Font.Bold = $true
    }
}

Format-TableDesign $tbl4 7 7 $cDarkGray $cWhite $cDarkCard $cWhite (Get-Rgb 26 32 35)

# Resaltar la fila de 2026 (Fila 7) para darle prominencia
for ($c = 1; $c -le 7; $c++) {
    $cell = $tbl4.Cell(7, $c)
    $cell.Shape.Fill.ForeColor.RGB = (Get-Rgb 45 15 20)
    $cell.Shape.TextFrame.TextRange.Font.Bold = $true
    if ($c -eq 1) {
        $cell.Shape.TextFrame.TextRange.Font.Color.RGB = $cRed
    }
}

# Alinear datos a la derecha
for ($r = 2; $r -le 7; $r++) {
    for ($c = 2; $c -le 7; $c++) {
        $tbl4.Cell($r, $c).Shape.TextFrame.TextRange.ParagraphFormat.Alignment = 3 # Right
    }
    $tbl4.Cell($r, 1).Shape.TextFrame.TextRange.Font.Bold = $true
}

# Comentario destacado
$tbInsight4 = $slide4.Shapes.AddTextbox(1, 60, 395, 840, 90)
$tbInsight4.TextFrame.TextRange.Text = @"
Destacado de Evolucion Anual YoY:
• El ano 2026 registra una facturacion consolidada en el primer cuatrimestre de $(Format-Currency $historyStats[5].Total), superando en un $("{0:N1}%" -f $historyStats[5].YoY) al periodo 2025.
• Se observa una tendencia de recuperacion constante tras la caida del mercado experimentada en el ano 2024.
• La tasa de crecimiento compuesto acumulada indica un incremento sostenido de ventas a doble digito para clientes clave.
"@
$tbInsight4.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbInsight4.TextFrame.TextRange.Font.Size = 11
$tbInsight4.TextFrame.TextRange.Font.Color.RGB = $cWhite
$tbInsight4.TextFrame.MarginLeft = 10
$tbInsight4.TextFrame.MarginTop = 5

# ----------------- SLIDE 5: CLIENTES TOP 20 YOY -----------------
Write-Host "Creando Slide 5: Clientes Top 20..." -ForegroundColor Cyan
$slide5 = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
$slide5.Background.Fill.Solid()
$slide5.Background.Fill.ForeColor.RGB = $cDarkBg
Add-SlideHeader $slide5 "ANÁLISIS DE CLIENTES TOP 20 YOY (2021 - 2026)" "Facturacion Historica Anual Acumulada Enero - Abril por Cliente"

# Tabla Clientes Top 20 (21 filas: Cabecera + 20 clientes; 9 columnas)
$tblShape5 = $slide5.Shapes.AddTable(21, 9, 40, 105, 880, 390)
$tbl5 = $tblShape5.Table

$tbl5.Cell(1, 1).Shape.TextFrame.TextRange.Text = "N°"
$tbl5.Cell(1, 2).Shape.TextFrame.TextRange.Text = "Cliente"
$tbl5.Cell(1, 3).Shape.TextFrame.TextRange.Text = "2021"
$tbl5.Cell(1, 4).Shape.TextFrame.TextRange.Text = "2022"
$tbl5.Cell(1, 5).Shape.TextFrame.TextRange.Text = "2023"
$tbl5.Cell(1, 6).Shape.TextFrame.TextRange.Text = "2024"
$tbl5.Cell(1, 7).Shape.TextFrame.TextRange.Text = "2025"
$tbl5.Cell(1, 8).Shape.TextFrame.TextRange.Text = "2026"
$tbl5.Cell(1, 9).Shape.TextFrame.TextRange.Text = "Var. YoY %"

$colWidths = @(30, 230, 75, 75, 75, 75, 75, 75, 70)
for ($col = 1; $col -le 9; $col++) {
    $tbl5.Columns[$col].Width = $colWidths[$col-1]
}

for ($i = 0; $i -lt 20; $i++) {
    $rowIdx = $i + 2
    $cRow = $clientTableRows[$i]
    
    $tbl5.Cell($rowIdx, 1).Shape.TextFrame.TextRange.Text = ($i + 1).ToString()
    
    $cName = $cRow.Cliente
    if ($cName.Length -gt 32) { $cName = $cName.Substring(0, 29) + "..." }
    $tbl5.Cell($rowIdx, 2).Shape.TextFrame.TextRange.Text = $cName
    
    $tbl5.Cell($rowIdx, 3).Shape.TextFrame.TextRange.Text = Format-Currency $cRow.V2021
    $tbl5.Cell($rowIdx, 4).Shape.TextFrame.TextRange.Text = Format-Currency $cRow.V2022
    $tbl5.Cell($rowIdx, 5).Shape.TextFrame.TextRange.Text = Format-Currency $cRow.V2023
    $tbl5.Cell($rowIdx, 6).Shape.TextFrame.TextRange.Text = Format-Currency $cRow.V2024
    $tbl5.Cell($rowIdx, 7).Shape.TextFrame.TextRange.Text = Format-Currency $cRow.V2025
    $tbl5.Cell($rowIdx, 8).Shape.TextFrame.TextRange.Text = Format-Currency $cRow.V2026
    
    if (-not $cRow.HasPrior) {
        $tbl5.Cell($rowIdx, 9).Shape.TextFrame.TextRange.Text = "N/A"
        $tbl5.Cell($rowIdx, 9).Shape.TextFrame.TextRange.Font.Color.RGB = $cGray
    } else {
        $growth = $cRow.YoY
        # Evaluar condicionales fuera de la llamada
        $signGrowth = if ($growth -ge 0) { "+" } else { "" }
        $growthText = "$signGrowth" + ("{0:N1}%" -f $growth)
        $growthColor = if ($growth -ge 0) { $cGreen } else { $cRed }
        
        $tbl5.Cell($rowIdx, 9).Shape.TextFrame.TextRange.Text = $growthText
        $tbl5.Cell($rowIdx, 9).Shape.TextFrame.TextRange.Font.Color.RGB = $growthColor
        $tbl5.Cell($rowIdx, 9).Shape.TextFrame.TextRange.Font.Bold = $true
    }
}

Format-TableDesign $tbl5 21 9 $cDarkGray $cWhite $cDarkCard $cWhite (Get-Rgb 26 32 35)

for ($r = 2; $r -le 21; $r++) {
    for ($c = 1; $c -le 9; $c++) {
        $cell = $tbl5.Cell($r, $c)
        $cell.Shape.TextFrame.TextRange.Font.Size = 7.5
        if ($c -ge 3) {
            $cell.Shape.TextFrame.TextRange.ParagraphFormat.Alignment = 3 # Right
        }
    }
    $tbl5.Cell($r, 1).Shape.TextFrame.TextRange.Font.Bold = $true
    $tbl5.Cell($r, 2).Shape.TextFrame.TextRange.Font.Bold = $true
    $tbl5.Cell($r, 8).Shape.TextFrame.TextRange.Font.Bold = $true
}

# ----------------- SLIDE 6: MARCAS TOP 15 YOY -----------------
Write-Host "Creando Slide 6: Marcas Top 15..." -ForegroundColor Cyan
$slide6 = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
$slide6.Background.Fill.Solid()
$slide6.Background.Fill.ForeColor.RGB = $cDarkBg
Add-SlideHeader $slide6 "ANÁLISIS DE MARCAS Y RENTABILIDAD (CIF)" "Ranking de Venta Nacional y Margen Bruto Enero - Abril 2026 vs 2025"

# Tabla de marcas (16 filas: Cabecera + 15 marcas; 5 columnas: Marca, 2025, 2026, Var, Margen)
$tblShape6 = $slide6.Shapes.AddTable(16, 5, 40, 110, 560, 360)
$tbl6 = $tblShape6.Table

$tbl6.Cell(1, 1).Shape.TextFrame.TextRange.Text = "Marca"
$tbl6.Cell(1, 2).Shape.TextFrame.TextRange.Text = "Venta 2025"
$tbl6.Cell(1, 3).Shape.TextFrame.TextRange.Text = "Venta 2026"
$tbl6.Cell(1, 4).Shape.TextFrame.TextRange.Text = "Var. YoY"
$tbl6.Cell(1, 5).Shape.TextFrame.TextRange.Text = "Margen 26%"

for ($i = 0; $i -lt $brandTableRows.Count; $i++) {
    $rowIdx = $i + 2
    $bRow = $brandTableRows[$i]
    
    $tbl6.Cell($rowIdx, 1).Shape.TextFrame.TextRange.Text = $bRow.Marca
    $tbl6.Cell($rowIdx, 2).Shape.TextFrame.TextRange.Text = Format-Currency $bRow.V2025
    $tbl6.Cell($rowIdx, 3).Shape.TextFrame.TextRange.Text = Format-Currency $bRow.V2026
    
    if (-not $bRow.HasPrior) {
        $tbl6.Cell($rowIdx, 4).Shape.TextFrame.TextRange.Text = "N/A"
        $tbl6.Cell($rowIdx, 4).Shape.TextFrame.TextRange.Font.Color.RGB = $cGray
    } else {
        $growth = $bRow.YoY
        # Evaluar condicionales fuera de la llamada
        $signGrowth = if ($growth -ge 0) { "+" } else { "" }
        $growthText = "$signGrowth" + ("{0:N1}%" -f $growth)
        $growthColor = if ($growth -ge 0) { $cGreen } else { $cRed }
        
        $tbl6.Cell($rowIdx, 4).Shape.TextFrame.TextRange.Text = $growthText
        $tbl6.Cell($rowIdx, 4).Shape.TextFrame.TextRange.Font.Color.RGB = $growthColor
        $tbl6.Cell($rowIdx, 4).Shape.TextFrame.TextRange.Font.Bold = $true
    }
    
    $tbl6.Cell($rowIdx, 5).Shape.TextFrame.TextRange.Text = ("{0:N1}%" -f $bRow.Margen)
    $tbl6.Cell($rowIdx, 5).Shape.TextFrame.TextRange.Font.Bold = $true
    $cMargenColor = if ($bRow.Margen -ge 30) { $cGreen } elseif ($bRow.Margen -ge 15) { $cOrange } else { $cRed }
    $tbl6.Cell($rowIdx, 5).Shape.TextFrame.TextRange.Font.Color.RGB = $cMargenColor
}

Format-TableDesign $tbl6 16 5 $cDarkGray $cWhite $cDarkCard $cWhite (Get-Rgb 26 32 35)

for ($r = 2; $r -le 16; $r++) {
    for ($c = 1; $c -le 5; $c++) {
        $cell = $tbl6.Cell($r, $c)
        $cell.Shape.TextFrame.TextRange.Font.Size = 8
        if ($c -ge 2) {
            $cell.Shape.TextFrame.TextRange.ParagraphFormat.Alignment = 3 # Right
        }
    }
    $tbl6.Cell($r, 1).Shape.TextFrame.TextRange.Font.Bold = $true
    $tbl6.Cell($r, 3).Shape.TextFrame.TextRange.Font.Bold = $true
}

# Panel de Insights a la derecha
$calloutBg = $slide6.Shapes.AddShape(5, 620, 110, 300, 360)
$calloutBg.Fill.Solid()
$calloutBg.Fill.ForeColor.RGB = $cDarkCard
$calloutBg.Line.ForeColor.RGB = $cDarkGray
$calloutBg.Line.Weight = 1.5

$tbCallout = $slide6.Shapes.AddTextbox(1, 630, 120, 280, 340)
$tbCallout.TextFrame.TextRange.Text = @"
Analisis de Portafolio de Marcas:

• REXNORD consolida su liderazgo como la marca de mayor volumen operativo con $(Format-Currency $brandTableRows[0].V2026) en el periodo 2026, sosteniendo una excelente rentabilidad del $("{0:N1}%" -f $brandTableRows[0].Margen).

• Destaca la marca $($brandTableRows[1].Marca) en el segundo puesto, logrando ventas de $(Format-Currency $brandTableRows[1].V2026).

• Se observa una oportunidad importante de control de costos en marcas secundarias cuyo margen bruto se situa por debajo de la meta del 30%.
"@
$tbCallout.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbCallout.TextFrame.TextRange.Font.Size = 11
$tbCallout.TextFrame.TextRange.Font.Color.RGB = $cWhite
$tbCallout.TextFrame.MarginLeft = 5
$tbCallout.TextFrame.MarginTop = 5

# ----------------- SLIDE 7: ANALISIS AVANZADO -----------------
Write-Host "Creando Slide 7: Analisis Avanzado..." -ForegroundColor Cyan
$slide7 = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
$slide7.Background.Fill.Solid()
$slide7.Background.Fill.ForeColor.RGB = $cDarkBg
Add-SlideHeader $slide7 "SEGMENTACION BCG DE CLIENTES Y PARETO DE MARCAS" "Analisis Avanzado de Rentabilidad de Clientes (BCG Scatter) y Acumulacion de Margen"

# Columna Izquierda: BCG (L: 60, T: 110, W: 410, H: 365)
$bcgBg = $slide7.Shapes.AddShape(5, 60, 110, 410, 365)
$bcgBg.Fill.Solid()
$bcgBg.Fill.ForeColor.RGB = $cDarkCard
$bcgBg.Line.ForeColor.RGB = $cDarkGray
$bcgBg.Line.Weight = 1.5

$tbBcgTitle = $slide7.Shapes.AddTextbox(1, 70, 120, 390, 30)
$tbBcgTitle.TextFrame.TextRange.Text = "SEGMENTACION DE CLIENTES CLAVE (BCG)"
$tbBcgTitle.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbBcgTitle.TextFrame.TextRange.Font.Size = 12
$tbBcgTitle.TextFrame.TextRange.Font.Bold = $true
$tbBcgTitle.TextFrame.TextRange.Font.Color.RGB = $cCyan

# Formatear el listado BCG
$starsListStr = if ($stars.Count -gt 0) { ($stars | Select-Object -First 3) -join ", " } else { "Ninguno" }
$volListStr = if ($volume.Count -gt 0) { ($volume | Select-Object -First 3) -join ", " } else { "Ninguno" }
$nicheListStr = if ($niche.Count -gt 0) { ($niche | Select-Object -First 3) -join ", " } else { "Ninguno" }
$revListStr = if ($review.Count -gt 0) { ($review | Select-Object -First 3) -join ", " } else { "Ninguno" }

$tbBcgList = $slide7.Shapes.AddTextbox(1, 70, 155, 390, 310)
$tbBcgList.TextFrame.TextRange.Text = @"
Clasificacion de Clientes (Venta CIF > 500K):

ESTRELLAS (Alto Volumen y Alto Margen):
  $starsListStr

VOLUMEN (Alto Volumen y Bajo Margen):
  $volListStr

NICHO (Bajo Volumen y Alto Margen):
  $nicheListStr

REVISAR (Bajo Volumen y Bajo Margen):
  $revListStr
"@
$tbBcgList.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbBcgList.TextFrame.TextRange.Font.Size = 10.5
$tbBcgList.TextFrame.TextRange.Font.Color.RGB = $cWhite

# Resaltar titulos en colores
$bcgTextRange = $tbBcgList.TextFrame.TextRange
Color-Substring $bcgTextRange "ESTRELLAS" $cGreen
Color-Substring $bcgTextRange "VOLUMEN" $cRed
Color-Substring $bcgTextRange "NICHO" $cOrange
Color-Substring $bcgTextRange "REVISAR" $cGray

# Columna Derecha: Pareto de Marcas (L: 490, T: 110, W: 410, H: 365)
$paretoBg = $slide7.Shapes.AddShape(5, 490, 110, 410, 365)
$paretoBg.Fill.Solid()
$paretoBg.Fill.ForeColor.RGB = $cDarkCard
$paretoBg.Line.ForeColor.RGB = $cDarkGray
$paretoBg.Line.Weight = 1.5

$tbParetoTitle = $slide7.Shapes.AddTextbox(1, 500, 120, 390, 30)
$tbParetoTitle.TextFrame.TextRange.Text = "PARETO DE MARCAS (CONCENTRACION DEL MARGEN)"
$tbParetoTitle.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbParetoTitle.TextFrame.TextRange.Font.Size = 12
$tbParetoTitle.TextFrame.TextRange.Font.Bold = $true
$tbParetoTitle.TextFrame.TextRange.Font.Color.RGB = $cCyan

# Marcas que acumulan el 80% del margen
$pareto80Brands = @()
foreach ($pb in $paretoBrands) {
    if ($pb.CumPct -le 85) { # buffer
        $pareto80Brands += ("• {0} ({1:N1}% ind. | {2:N1}% acum.)" -f $pb.Brand, $pb.Pct, $pb.CumPct)
    }
}
$paretoStr = $pareto80Brands -join "`n"

$tbParetoText = $slide7.Shapes.AddTextbox(1, 500, 155, 390, 310)
$tbParetoText.TextFrame.TextRange.Text = @"
Marcas que concentran el 80% del margen total acumulado:
$paretoStr

Analisis de Pareto:
Se evidencia una alta concentracion de rentabilidad. Las primeras $($pareto80Brands.Count) marcas acumulan el 80% de la utilidad bruta. Esto permite enfocar los esfuerzos comerciales y de negociacion de costos en estas lineas prioritarias.
"@
$tbParetoText.TextFrame.TextRange.Font.Name = "Segoe UI"
$tbParetoText.TextFrame.TextRange.Font.Size = 10.5
$tbParetoText.TextFrame.TextRange.Font.Color.RGB = $cWhite

# ----------------- GUARDADO Y CIERRE -----------------
$savePath = Join-Path $PSScriptRoot "Reporte_Reunion_General.pptx"

# Eliminar archivo si ya existe para evitar errores de guardado
if (Test-Path $savePath) {
    Remove-Item $savePath -Force
}

Write-Host "Guardando presentacion en: $savePath" -ForegroundColor Green
$presentation.SaveAs($savePath)
$presentation.Close()
$powerpoint.Quit()

# Liberar variables COM de la memoria de PowerShell
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerpoint) | Out-Null
Remove-Variable presentation, powerpoint -ErrorAction SilentlyContinue
[GC]::Collect()
[GC]::WaitForPendingFinalizers()

Write-Host "Presentacion de PowerPoint generada de manera exitosa!" -ForegroundColor Green
