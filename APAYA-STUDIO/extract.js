const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\farha\\.gemini\\antigravity\\brain\\5fdffefa-e0fc-4c1e-821d-0f4705f6d16b\\.system_generated\\logs\\transcript.jsonl', 'utf8').split('\n');
let cnt = 0;
for (let l of lines) {
    if (l.includes('"type":"CODE_ACTION"') && l.includes('dashboard.html') && l.includes('diff_block_start')) {
        fs.writeFileSync('diff_line.txt', l);
        cnt++;
    }
}
console.log('Count:', cnt);
