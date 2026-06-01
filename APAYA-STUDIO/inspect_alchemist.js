const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let src = fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');

// Print context around the alchemist block
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('request_alchemist')) {
    console.log('Found request_alchemist at line', i+1);
    for (let j = i; j < Math.min(i+50, lines.length); j++) {
      console.log(`${j+1}: ${JSON.stringify(lines[j])}`);
    }
    break;
  }
}
