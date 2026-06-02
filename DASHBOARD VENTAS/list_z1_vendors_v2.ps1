
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$allInvoices = $json.invoices | ForEach-Object { $_.factura }

$vendors = @{}
foreach ($inv in $allInvoices) {
    $idZona = [string]$inv.ID_ZONA
    $destDesc = ([string]$inv.DESCRIPCION_DESTINO).ToUpper()
    $isZ5 = ($idZona -eq "05" -or $destDesc -like "*CAFETERO*" -or $destDesc -like "*PEREIRA*" -or $destDesc -like "*MANIZALES*" -or $destDesc -like "*ARMENIA*" -or $destDesc -like "*DOSQUEBRADAS*")
    
    if (-not $isZ5) {
        $docType = ([string]$inv.ID_TIPO_DOC).ToUpper()
        if ($docType -like "*EX*") { continue }
        
        $vend = ([string]$inv.NOMBRE_VENDEDOR).ToUpper()
        
        $sub = 0
        foreach ($item in $inv.items) {
            $sub += $item.SUBTOTAL
        }
        $vendors[$vend] += $sub
    }
}

$vendors.GetEnumerator() | Sort-Object Value -Descending
