const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let src = fs.readFileSync(TARGET, 'utf8');
const lines = src.split(/\r?\n/);

const idx = lines.findIndex(l => l.includes('if b64_data.to_s.start_with?("http")'));
if (idx !== -1) {
    const newBlock = `    if b64_data.to_s.start_with?("http")
      return b64_data
    elsif b64_data.to_s.start_with?("file:///")
      file_path = b64_data.to_s.sub("file:///", "").gsub("%20", " ")
      begin
        request["Content-Type"] = file_path.downcase.end_with?(".png") ? "image/png" : "image/jpeg"
        request.body = File.open(file_path, 'rb').read
      rescue => e
        puts "[ERROR] Gagal membaca file lokal: #{e.message}"
        return nil
      end
    else
      # Deteksi content-type dari header data URI (image/png vs image/jpeg)`;

    // Remove the original 4 lines
    lines.splice(idx, 4, newBlock);
    fs.writeFileSync(TARGET, lines.join('\n'), 'utf8');
    console.log("Updated main.rb successfully.");
} else {
    console.log("Pattern not found");
}
