
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$carlosInvoices = $json.invoices | Where-Object { $_.factura.NOMBRE_VENDEDOR -like "*CORTES MARTINEZ CARLOS ORLANDO*" }
$matches = $carlosInvoices | Where-Object { $_.factura.TIPO -eq "YM" }

$report = @()
foreach ($inv in $matches) {
    $f = $inv.factura
    foreach ($item in $f.items) {
        $report += [PSCustomObject]@{
            Numero = $f.NUMERO
            Fecha = $f.FECHA
            Cliente = $f.NOMBRE_TERCERO
            Total = $item.TOTAL
            Subtotal = $item.SUBTOTAL
        }
    }
}

$report | Export-Csv -Path "carlos_report.csv" -NoTypeInformation
$report | Group-Object Numero | Select-Object Name, @{Name="TotalInvoice"; Expression={($_.Group | Measure-Object Total -Sum).Sum}} | ConvertTo-Json
