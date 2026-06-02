
$json = Get-Content "temp_invoices.json" -Raw | ConvertFrom-Json
$inv = $json.invoices | ForEach-Object { $_.factura } | Where-Object { [string]$_.NUMERO -eq "292" }
$inv | Get-Member -MemberType NoteProperty | Select-Object Name
