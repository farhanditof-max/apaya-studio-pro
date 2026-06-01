const fs = require('fs');
const targetFile = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let content = fs.readFileSync(targetFile, 'utf8');

// Replace all .gsub('\\', '/') or .gsub("\\", "/") with .gsub('\\', '/').gsub(' ', '%20').gsub('#', '%23')
content = content.replace(/\.gsub\(['"]\\\\['"], ['"]\/['"]\)/g, ".gsub('\\\\', '/').gsub(' ', '%20').gsub('#', '%23')");

fs.writeFileSync(targetFile, content, 'utf8');
console.log("main.rb URL encoding patched!");
