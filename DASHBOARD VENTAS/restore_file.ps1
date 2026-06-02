try {
    $filePath = "script.js"
    # Read the file as raw UTF-8 string
    $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    
    # Convert to Windows-1252 bytes
    $enc1252 = [System.Text.Encoding]::GetEncoding(1252)
    $bytes = $enc1252.GetBytes($content)
    
    # Interpret those bytes as UTF-8
    $restored = [System.Text.Encoding]::UTF8.GetString($bytes)
    
    # Search for MEDELLIN/MEDELLÍN lines in the restored text
    $lines = $restored -split "\r?\n"
    $matching = $lines | Where-Object { $_ -like "*MEDELL*" }
    Write-Host "Restored lines:"
    $matching | ForEach-Object { Write-Host $_ }
} catch {
    Write-Host "Error: $_"
}
