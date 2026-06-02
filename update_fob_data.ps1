# PowerShell script to extract Pedidos FOB Commissions data using bulk load and read-only mode
$ErrorActionPreference = "Stop"

$excelPath = "C:\Users\ven444\OneDrive - CAPROIN\Escritorio\JUAN L CAPROIN\INFORMES DE VENTAS\DASHBOARD VENTAS\DASHBOARD VENTAS\Pedidos FOB 28052026.xlsx"
$outputPath = "C:\Users\ven444\OneDrive - CAPROIN\Escritorio\JUAN L CAPROIN\INFORMES DE VENTAS\DASHBOARD VENTAS\DASHBOARD VENTAS\pedidos_fob_data.js"

Write-Host "Opening Excel file as Read-Only..."
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
# Workbooks.Open(FileName, UpdateLinks, ReadOnly)
$workbook = $excel.Workbooks.Open($excelPath, 0, $true)

$sheet = $null
try {
    $sheet = $workbook.Worksheets.Item("PEDIDOS FOB CONSOLIDADO")
} catch {
    $sheet = $workbook.Worksheets.Item(1)
}

if (-not $sheet) {
    Write-Error "Could not load the sheet!"
    $workbook.Close($false)
    $excel.Quit()
    exit 1
}

Write-Host "Bulk reading sheet: $($sheet.Name)"
$range = $sheet.UsedRange
$values = $range.Value2
$rowCount = $range.Rows.Count
$colCount = $range.Columns.Count

Write-Host "Total rows in Excel range: $rowCount"

$data = @()

for ($r = 2; $r -le $rowCount; $r++) {
    $valFecha = $values[$r, 1]
    $valZona = $values[$r, 2]
    $valMes = $values[$r, 3]
    $valAnio = $values[$r, 4]
    $valVendedor = $values[$r, 6]
    $valCasa = $values[$r, 8]
    $valComision = $values[$r, 15]
    $valEstado = $values[$r, 16]

    # Convert to string and clean
    $strFecha = if ($valFecha) { "$valFecha" } else { "" }
    $strZona = if ($valZona) { "$valZona".Trim() } else { "" }
    $strMes = if ($valMes) { "$valMes".Trim() } else { "" }
    $strAnio = if ($valAnio) { "$valAnio".Trim() } else { "" }
    $strVendedor = if ($valVendedor) { "$valVendedor".Trim() } else { "" }
    $strCasa = if ($valCasa) { "$valCasa".Trim() } else { "" }
    $strEstado = if ($valEstado) { "$valEstado".Trim() } else { "" }

    if ($strFecha -eq "" -and $strVendedor -eq "" -and $strCasa -eq "") {
        continue
    }

    # Filter: ONLY keep commissions from 2026
    if ($strAnio -ne "2026") {
        continue
    }

    # Parse commission
    $comVal = 0.0
    if ($valComision -ne $null) {
        if ($valComision -is [double] -or $valComision -is [int] -or $valComision -is [decimal]) {
            $comVal = [double]$valComision
        } else {
            $clean = "$valComision" -replace '[^\d\.]', ''
            [double]::TryParse($clean, [ref]$comVal) | Out-Null
        }
    }

    # "PAGADA" means invoiced/facturada. Blank or other values mean pending/por facturar.
    $facturada = $false
    if ($strEstado.Trim().ToUpper() -eq "PAGADA") {
        $facturada = $true
    }

    $item = @{
        fecha = $strFecha
        zona = $strZona
        mes = $strMes
        anio = $strAnio
        vendedor = $strVendedor
        casa = $strCasa
        comision = $comVal
        factura = $strEstado
        facturada = $facturada
    }
    $data += $item
}

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

Write-Host "Read $($data.Count) rows of data."

# Convert to JS file
$json = ConvertTo-Json $data -Compress
$jsContent = "const PEDIDOS_FOB_DATA = $json;"
Set-Content -Path $outputPath -Value $jsContent -Encoding utf8

Write-Host "Overwritten $outputPath successfully!"
