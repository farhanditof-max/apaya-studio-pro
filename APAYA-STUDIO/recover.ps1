$logPath = "C:\Users\farha\.gemini\antigravity\brain\5fdffefa-e0fc-4c1e-821d-0f4705f6d16b\.system_generated\logs\transcript.jsonl"
$targetFile = "K:\Project\## PLUGINS APAYA\APAYA-STUDIO\ui\dashboard.html"

# Read the log file line by line
$diffText = ""
Get-Content $logPath -Encoding UTF8 | ForEach-Object {
    if ($_ -match '"type":"MULTI_REPLACE_FILE_CONTENT"') {
        $json = $_ | ConvertFrom-Json
        if ($json.content -match "dashboard.html") {
            $diffText = $json.content
        }
    }
}

if (-not $diffText) {
    Write-Host "Diff not found!"
    exit 1
}

# Parse the diff
$inDiff = $false
$originalLines = @()
$deletedCount = 0
$insertedCount = 0

foreach ($line in ($diffText -split "`n")) {
    if ($line -match "\[diff_block_start\]") {
        $inDiff = $true
        continue
    }
    if ($inDiff) {
        if ($line -match "^@@ -(\d+),(\d+) \+(\d+),(\d+) @@") {
            $deletedCount = [int]$matches[2]
            $insertedCount = [int]$matches[4]
            continue
        }
        
        if ($line.StartsWith("-") -or $line.StartsWith(" ")) {
            # Note: handle the trailing carriage return if any
            $cleaned = $line.Substring(1).TrimEnd("`r")
            $originalLines += $cleaned
        }
    }
}

Write-Host "Recovered $($originalLines.Count) lines."
Write-Host "Deleted: $deletedCount, Inserted: $insertedCount"

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
