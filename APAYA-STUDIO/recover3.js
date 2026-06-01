const fs = require('fs');

const diffLine = fs.readFileSync('diff_line.txt', 'utf8');
const obj = JSON.parse(diffLine);

let contentStr = '';
if (obj.content) {
    contentStr = obj.content;
} else if (obj.tool_calls) {
    // If it's a request, not a response
    console.log("This is a tool call request, not the output!");
    process.exit(1);
}

if (!contentStr.includes('[diff_block_start]')) {
    console.log("Diff block not found in this line.");
    process.exit(1);
}

let inDiff = false;
const originalLines = [];
let deletedCount = 0;
let insertedCount = 0;

for (let line of contentStr.split('\n')) {
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
            originalLines.push(line.substring(1));
        }
    }
}

console.log(`Recovered ${originalLines.length} lines.`);
console.log(`Deleted: ${deletedCount}, Inserted: ${insertedCount}`);

const corruptedLines = fs.readFileSync('ui/dashboard.html', 'utf8').split(/\r?\n/);

const prefix = corruptedLines.slice(0, 603);
const suffix = corruptedLines.slice(603 + insertedCount);

const recoveredContent = prefix.join('\r\n') + '\r\n' + originalLines.join('\r\n') + '\r\n' + suffix.join('\r\n');

fs.writeFileSync('ui/dashboard.html.recovered.html', recoveredContent, 'utf8');
console.log('Written to ui/dashboard.html.recovered.html');
