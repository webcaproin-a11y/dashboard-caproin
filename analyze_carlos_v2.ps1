
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$allInvoices = $json.invoices | ForEach-Object { $_.factura }
$carlosInvoices = $allInvoices | Where-Object { $_.NOMBRE_VENDEDOR -like "*CORTES*" -and $_.NOMBRE_VENDEDOR -like "*CARLOS*" }

$targetNumbers = @("3882", "3884", "3886", "3887", "3888", "3889", "3893", "3898", "3899", "3902", "3904", "3905", "3906", "3917", "3919", "3920", "3927", "3929", "3930")

$report = @()
foreach ($inv in $carlosInvoices) {
    if ($inv.TIPO -eq "YM" -or $inv.ID_TIPO_DOC -eq "YM") {
        $num = [string]$inv.NUMERO
        if ($targetNumbers -contains $num) {
            $totalInv = 0
            foreach ($item in $inv.items) {
                $totalInv += $item.TOTAL
            }
            $report += [PSCustomObject]@{
                Numero = $inv.NUMERO
                Fecha = $inv.FECHA
                Cliente = $inv.NOMBRE_TERCERO
                Total = $totalInv
                Vendedor = $inv.NOMBRE_VENDEDOR
            }
        }
    }
}

$report | Select-Object Numero, Fecha, Total, Cliente | Sort-Object Numero | ConvertTo-Json
