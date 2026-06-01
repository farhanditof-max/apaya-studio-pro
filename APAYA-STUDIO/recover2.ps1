$line = Get-Content "K:\Project\## PLUGINS APAYA\APAYA-STUDIO\diff_line.txt" -Encoding UTF8
$match = $line -match '"content":"(.+?)"}'
if ($match) {
    $content = $matches[1]
    # Unescape JSON string manually for basic stuff
    $content = $content -replace '\\n', "`n" -replace '\\r', "`r" -replace '\\"', '"' -replace '\\\\', '\'
    
    $inDiff = $false
    $originalLines = @()
    $deletedCount = 0
    $insertedCount = 0

    foreach ($l in ($content -split "`n")) {
        if ($l -match '\[diff_block_start\]') {
            $inDiff = $true
            continue
        }
        if ($inDiff) {
            if ($l -match "^@@ -(\d+),(\d+) \+(\d+),(\d+) @@") {
                $deletedCount = [int]$matches[2]
                $insertedCount = [int]$matches[4]
                continue
            }
            if ($l.StartsWith("-") -or $l.StartsWith(" ")) {
                $cleaned = $l.Substring(1).TrimEnd("`r")
                $originalLines += $cleaned
            }
        }
    }
    
    Write-Host "Recovered $($originalLines.Count) lines."
    Write-Host "Deleted: $deletedCount, Inserted: $insertedCount"
    
    $targetFile = "K:\Project\## PLUGINS APAYA\APAYA-STUDIO\ui\dashboard.html"
    $corruptedLines = Get-Content $targetFile -Encoding UTF8
    
    $prefix = $corruptedLines[0..602]
    $suffixStart = 603 + $insertedCount
    if ($suffixStart -lt $corruptedLines.Count) {
        $suffix = $corruptedLines[$suffixStart..($corruptedLines.Count - 1)]
    } else {
        $suffix = @()
    }

    $recoveredFile = "$targetFile.recovered.html"
    $prefix | Set-Content $recoveredFile -Encoding UTF8
    $originalLines | Add-Content $recoveredFile -Encoding UTF8
    $suffix | Add-Content $recoveredFile -Encoding UTF8

    Write-Host "Written to $recoveredFile"
} else {
    Write-Host "Regex match failed on diff_line.txt"
}
