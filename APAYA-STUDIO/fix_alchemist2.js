const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let src = fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');

// Lines 861-888 (1-indexed) = indices 860-887 (0-indexed)
// Replace from "UI.start_timer(0.5, false) do" to "    end" (closing the callback)
const startIdx = 860; // line 861 (0-indexed)
const endIdx = 887;   // line 888 (0-indexed), inclusive

console.log('Replacing lines:');
console.log('START:', lines[startIdx]);
console.log('END:', lines[endIdx]);

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
console.log('New total lines:', lines.length);
