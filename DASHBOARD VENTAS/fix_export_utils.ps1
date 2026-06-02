$filePath = "c:\Users\ven444\OneDrive - CAPROIN\Escritorio\JUAN L CAPROIN\INFORMES DE VENTAS\DASHBOARD VENTAS\DASHBOARD VENTAS\export-utils.js"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# Replacement 1
$target1 = @"
/**
 * Captura una tabla como imagen de alta resolucion usando html2canvas
 * @param {string} tableId - ID del elemento table o su contenedor
 * @param {string} fileName - Nombre base del archivo
 */
    const element = document.getElementById(tableId);
"@

$replacement1 = @"
/**
 * Captura una tabla como imagen de alta resolucion usando html2canvas
 * @param {string} tableId - ID del elemento table o su contenedor
 * @param {string} fileName - Nombre base del archivo
 */
async function exportTableAsImage(tableId, fileName) {
    const element = document.getElementById(tableId);
"@

# Replacement 2
$target2 = @"
/**
 * Captura una tabla o caja como imagen de alta resolucion usando html2canvas
 * @param {string} elementId - ID del elemento a capturar
 * @param {string} fileName - Nombre base del archivo
 */
    const element = document.getElementById(elementId);
"@

$replacement2 = @"
/**
 * Captura una tabla o caja como imagen de alta resolucion usando html2canvas
 * @param {string} elementId - ID del elemento a capturar
 * @param {string} fileName - Nombre base del archivo
 */
async function captureElementAsImage(elementId, fileName) {
    const element = document.getElementById(elementId);
"@

if ($content.Contains($target1)) {
    $content = $content.Replace($target1, $replacement1)
    Write-Host "Replacement 1 matched and replaced."
} else {
    Write-Host "Replacement 1 NOT matched!"
}

if ($content.Contains($target2)) {
    $content = $content.Replace($target2, $replacement2)
    Write-Host "Replacement 2 matched and replaced."
} else {
    Write-Host "Replacement 2 NOT matched!"
}

[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done writing export-utils.js"
