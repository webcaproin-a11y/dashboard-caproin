$content = Get-Content -Path "c:\Users\ven444\OneDrive - CAPROIN\Escritorio\JUAN L CAPROIN\INFORMES DE VENTAS\DASHBOARD VENTAS\DASHBOARD VENTAS\script.js" -Raw
$stack = New-Object System.Collections.Generic.Stack[PSObject]
$i = 0
$len = $content.Length
$line = 1
$col = 1

while ($i -lt $len) {
    $c = $content[$i]
    
    # Handle comments
    if ($c -eq '/' -and $i + 1 -lt $len -and $content[$i+1] -eq '/') {
        # Single-line comment
        while ($i -lt $len -and $content[$i] -ne "`n") {
            $i++
        }
        $line++
        $col = 1
        continue
    }
    if ($c -eq '/' -and $i + 1 -lt $len -and $content[$i+1] -eq '*') {
        # Multi-line comment
        $i += 2
        while ($i + 1 -lt $len -and -not ($content[$i] -eq '*' -and $content[$i+1] -eq '/')) {
            if ($content[$i] -eq "`n") { $line++; $col = 1 } else { $col++ }
            $i++
        }
        $i += 2
        continue
    }

    # Handle strings
    if ($c -eq "'") {
        $i++
        while ($i -lt $len) {
            if ($content[$i] -eq "'") {
                # check if escaped
                $escapes = 0
                $k = $i - 1
                while ($k -ge 0 -and $content[$k] -eq '\') {
                    $escapes++
                    $k--
                }
                if ($escapes % 2 -eq 0) {
                    break
                }
            }
            if ($content[$i] -eq "`n") { $line++; $col = 1 } else { $col++ }
            $i++
        }
        $i++
        continue
    }
    if ($c -eq '"') {
        $i++
        while ($i -lt $len) {
            if ($content[$i] -eq '"') {
                # check if escaped
                $escapes = 0
                $k = $i - 1
                while ($k -ge 0 -and $content[$k] -eq '\') {
                    $escapes++
                    $k--
                }
                if ($escapes % 2 -eq 0) {
                    break
                }
            }
            if ($content[$i] -eq "`n") { $line++; $col = 1 } else { $col++ }
            $i++
        }
        $i++
        continue
    }
    if ($c -eq '`') {
        $i++
        while ($i -lt $len) {
            if ($content[$i] -eq '`') {
                # check if escaped
                $escapes = 0
                $k = $i - 1
                while ($k -ge 0 -and $content[$k] -eq '\') {
                    $escapes++
                    $k--
                }
                if ($escapes % 2 -eq 0) {
                    break
                }
            }
            if ($content[$i] -eq "`n") { $line++; $col = 1 } else { $col++ }
            $i++
        }
        $i++
        continue
    }

    if ($c -eq "`n") {
        $line++
        $col = 1
        $i++
        continue
    }

    if ($c -eq '(' -or $c -eq '{' -or $c -eq '[') {
        $stack.Push(@{ Symbol = $c; Line = $line; Col = $col; Index = $i })
    }
    elseif ($c -eq ')' -or $c -eq '}' -or $c -eq ']') {
        if ($stack.Count -eq 0) {
            Write-Output "Unmatched close symbol '$c' at Line $line, Col $col (char index $i)"
        } else {
            $top = $stack.Pop()
            $expected = $null
            if ($c -eq ')') { $expected = '(' }
            elseif ($c -eq '}') { $expected = '{' }
            elseif ($c -eq ']') { $expected = '[' }
            
            if ($top.Symbol -ne $expected) {
                Write-Output "Mismatch: Got '$c' at Line $line, Col $col. Expected matching for '$($top.Symbol)' from Line $($top.Line), Col $($top.Col)"
            }
        }
    }
    $i++
    $col++
}

while ($stack.Count -gt 0) {
    $item = $stack.Pop()
    Write-Output "Unclosed symbol '$($item.Symbol)' from Line $($item.Line), Col $($item.Col)"
}
