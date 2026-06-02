$filePath = "c:\Users\ven444\OneDrive - CAPROIN\Escritorio\JUAN L CAPROIN\INFORMES DE VENTAS\DASHBOARD VENTAS\DASHBOARD VENTAS\export-utils.js"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# Regex 1
# Matches:
# /**
#  * Captura una tabla como imagen de alta resolucion usando html2canvas
#  * @param {string} tableId - ID del elemento table o su contenedor
#  * @param {string} fileName - Nombre base del archivo
#  */
#     const element = document.getElementById(tableId);
$pattern1 = '(?ms)\/\*\*\s*\* Captura una tabla como imagen de alta resolucion usando html2canvas.*?\*\/(\s+)const element = document\.getElementById\(tableId\);'
$replacement1 = '/**`r`n * Captura una tabla como imagen de alta resolucion usando html2canvas`r`n * @param {string} tableId - ID del elemento table o su contenedor`r`n * @param {string} fileName - Nombre base del archivo`r`n */`r`nasync function exportTableAsImage(tableId, fileName) {`r`n    const element = document.getElementById(tableId);'

if ($content -match $pattern1) {
    $content = [regex]::Replace($content, $pattern1, $replacement1)
    Write-Host "Replacement 1 matched and replaced."
} else {
    Write-Host "Replacement 1 NOT matched!"
}

# Regex 2
# Matches:
# /**
#  * Captura una tabla o caja como imagen de alta resolucion usando html2canvas
#  * @param {string} elementId - ID del elemento a capturar
#  * @param {string} fileName - Nombre base del archivo
#  */
#     const element = document.getElementById(elementId);
$pattern2 = '(?ms)\/\*\*\s*\* Captura una tabla o caja como imagen de alta resolucion usando html2canvas.*?\*\/(\s+)const element = document\.getElementById\(elementId\);'
$replacement2 = '/**`r`n * Captura una tabla o caja como imagen de alta resolucion usando html2canvas`r`n * @param {string} elementId - ID del elemento a capturar`r`n * @param {string} fileName - Nombre base del archivo`r`n */`r`nasync function captureElementAsImage(elementId, fileName) {`r`n    const element = document.getElementById(elementId);'

if ($content -match $pattern2) {
    $content = [regex]::Replace($content, $pattern2, $replacement2)
    Write-Host "Replacement 2 matched and replaced."
} else {
    Write-Host "Replacement 2 NOT matched!"
}

[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done writing export-utils.js"
