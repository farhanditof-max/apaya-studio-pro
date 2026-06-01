const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\farha\\.gemini\\antigravity\\brain\\5fdffefa-e0fc-4c1e-821d-0f4705f6d16b\\.system_generated\\logs\\transcript.jsonl';
const targetFile = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\ui\\dashboard.html';

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
let diffText = null;

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.type === 'MULTI_REPLACE_FILE_CONTENT' && obj.content && obj.content.includes('dashboard.html')) {
            diffText = obj.content;
        }
    } catch (e) {
        // ignore
    }
}

if (!diffText) {
    console.error("Diff not found!");
    process.exit(1);
}

let inDiff = false;
const originalLines = [];
let deletedCount = 0;
let insertedCount = 0;

for (let line of diffText.split('\n')) {
    if (line.startsWith('[diff_block_start]')) {
        inDiff = true;
        continue;
    }
    if (inDiff) {
        if (line.startsWith('@@')) {
            const match = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
            if (match) {
                deletedCount = parseInt(match[2], 10);
                insertedCount = parseInt(match[4], 10);
            }
            continue;
        }
        
        if (line.startsWith('-') || line.startsWith(' ')) {
            // keep the exact original line, just strip the first character
            // Note: diff lines typically don't have \r, so we just take substring(1)
            originalLines.push(line.substring(1));
        }
    }
}

console.log(`Recovered ${originalLines.length} lines.`);
console.log(`Deleted: ${deletedCount}, Inserted: ${insertedCount}`);

const corruptedLines = fs.readFileSync(targetFile, 'utf8').split(/\r?\n/);

// The diff started at line 604, so 0 to 602 are the prefix (603 lines)
const prefix = corruptedLines.slice(0, 603);

// The inserted block ends at 603 + insertedCount
const suffix = corruptedLines.slice(603 + insertedCount);

const recoveredContent = prefix.join('\r\n') + '\r\n' + originalLines.join('\r\n') + '\r\n' + suffix.join('\r\n');

fs.writeFileSync(targetFile + '.recovered.html', recoveredContent, 'utf8');
console.log('Written to dashboard.html.recovered.html');
