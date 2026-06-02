$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$invoices = $json.invoices | ForEach-Object { 
    $f = $_.factura
    if ($null -eq $f) { $f = $_.pedido }
    if ($null -eq $f) { $f = $_ }
    $f
}

$years = $invoices | ForEach-Object { 
    try { 
        $d = [DateTime]::Parse($_.FECHA)
        $d.Year 
    } catch { 0 }
}

$years | Group-Object | Select-Object Name, Count | Sort-Object Name
