const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let src = fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n');

// Find start/end by line numbers (856-887 from the 0-indexed Get-Content = lines 857-888 in file 1-indexed)
const lines = src.split('\n');

// Find the line with "UI.start_timer(0.5, false) do" inside request_alchemist
// We know it's around line 863 (1-indexed). Find it precisely.
let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  // Look for the alchemist timer block
  if (lines[i].includes('UI.start_timer(0.5, false) do') && 
      lines[i-5] && lines[i-5].includes('Mulai memproses #{task_type}')) {
    startIdx = i;
  }
  if (startIdx !== -1 && lines[i].trimEnd() === '    end' && i > startIdx + 15) {
    // Check if this closes the alchemist callback
    if (lines[i+2] && lines[i+2].includes('GENERATE MOTION')) {
      endIdx = i;
      break;
    }
  }
}

if (startIdx === -1 || endIdx === -1) {
  console.error(`Could not find alchemist block: start=${startIdx} end=${endIdx}`);
  process.exit(1);
}

console.log(`Found alchemist timer block: lines ${startIdx+1} to ${endIdx+1}`);
console.log('START:', lines[startIdx]);
console.log('END:', lines[endIdx]);

// Replace lines startIdx to endIdx (inclusive)
const replacement = `      @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")
      _key=saved_key; _prompt=alchemist_prompt; _src=source_b64; _task=task_type; _cr=current_credits

      Thread.new do
        begin
          url_a = upload_b64_to_supabase(_src, "mat_alchemist_#{Time.now.to_i}.jpg")
          if url_a
            status = request_ai_render(_key, _prompt, url_a, nil, _task)
            if status == "ERROR"
              UI.start_timer(0, false) do
                @dialog.execute_script("document.getElementById('mat-loading-overlay').style.display='none'; showApayaModal('API Error', 'Gagal memproses ke server.', 'fa-triangle-exclamation', 'var(--danger)');")
                @dialog.execute_script("updateCreditDisplay(#{_cr});")
              end
            end
          else
            UI.start_timer(0, false) do
              @dialog.execute_script("document.getElementById('mat-loading-overlay').style.display='none'; showApayaModal('Upload Gagal', 'Gagal upload ke server.', 'fa-triangle-exclamation', 'var(--danger)');")
              @dialog.execute_script("updateCreditDisplay(#{_cr});")
            end
          end
        rescue => e
          puts "[\\u{274C} THREAD ERROR] #{e.message}"
          UI.start_timer(0, false) do
            @dialog.execute_script("document.getElementById('mat-loading-overlay').style.display='none'; showApayaModal('System Error', 'Error background thread.', 'fa-skull', 'var(--danger)');")
            @dialog.execute_script("updateCreditDisplay(#{_cr});")
          end
        end
      end
    end`;

lines.splice(startIdx, endIdx - startIdx + 1, replacement);
const result = lines.join('\n').replace(/\n/g, '\r\n');
fs.writeFileSync(TARGET, result, 'utf8');
console.log('✅ Alchemist block replaced successfully');
