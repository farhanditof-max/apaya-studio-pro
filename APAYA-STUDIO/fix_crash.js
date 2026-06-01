const fs = require('fs');
const path = require('path');

const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let src = fs.readFileSync(TARGET, 'utf8');

// Normalize all line endings to \n for reliable matching
src = src.replace(/\r\n/g, '\n');

let changed = 0;

function replace(label, from, to) {
  if (src.includes(from)) {
    src = src.replace(from, to);
    console.log(`✅ Fixed: ${label}`);
    changed++;
  } else {
    console.error(`❌ NOT FOUND: ${label}`);
  }
}

// =======================================================================
// FIX 1: get_scene_thumbnail — wrap model/view ops in UI.start_timer
// =======================================================================
replace(
  'get_scene_thumbnail wrapper',
  `    @dialog.add_action_callback("get_scene_thumbnail") do |_, cam_name|
      page = Sketchup.active_model.pages[cam_name]
      if page`,
  `    @dialog.add_action_callback("get_scene_thumbnail") do |_, cam_name|
      UI.start_timer(0.1, false) do
        begin
        page = Sketchup.active_model.pages[cam_name]
        if page`
);

replace(
  'get_scene_thumbnail close',
  `        if File.exist?(temp_img_path)
          # Send full-res PNG path as file:// URL — no base64, no 2nd render = no crash
          safe_url = ("file:///" + temp_img_path.gsub('\\\\', '/').gsub(' ', '%20').gsub('#', '%23') + "?t=#{Time.now.to_i}").to_json
          @dialog.execute_script("setBeforeImage(#{safe_url});")
        end
      end
    end`,
  `        if File.exist?(temp_img_path)
          safe_url = ("file:///" + temp_img_path.gsub('\\\\', '/').gsub(' ', '%20').gsub('#', '%23') + "?t=#{Time.now.to_i}").to_json
          @dialog.execute_script("setBeforeImage(#{safe_url});")
        end
        end
        rescue => e
          puts "[THUMBNAIL ERROR] #{e.message}"
        end
      end
    end`
);

// =======================================================================
// FIX 2: poll_supabase_job — revert to Sketchup::Http::Request (async)
// =======================================================================
replace(
  'poll_supabase_job async revert',
  `    # Tembak Supabase pakai API HTTP Asli Ruby (Anti-Crash)
    url_str = "#{@supabase_url}/rest/v1/ai_render_jobs?kie_job_id=eq.#{clean_task_id}&select=*"
    uri = URI(url_str)
    
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = 20

    request = Net::HTTP::Get.new(uri)
    request["apikey"] = @supabase_key
    request["Authorization"] = "Bearer #{@supabase_key}"
    request["Cache-Control"] = "no-cache, no-store, must-revalidate"
    
    begin
      res = http.request(request)
      if [200, 201].include?(res.code.to_i)
        body = self.safe_body(res)
        data = JSON.parse(body)`,
  `    # Async HTTP — does NOT block SketchUp main thread
    url_str = "#{@supabase_url}/rest/v1/ai_render_jobs?kie_job_id=eq.#{clean_task_id}&select=*"

    request = Sketchup::Http::Request.new(url_str, Sketchup::Http::GET)
    request.headers["apikey"] = @supabase_key
    request.headers["Authorization"] = "Bearer #{@supabase_key}"
    request.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"

    request.start do |req, res|
      begin
        if [200, 201].include?(res.status_code)
          body = res.body
          data = JSON.parse(body)`
);

// Fix the closing of poll_supabase_job (end block needs to match)
replace(
  'poll_supabase_job close',
  `        else
          puts "[HTTP ERROR] Server mengembalikan status: #{res.code}"
          UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
        end
      rescue => e
        puts "[POLLING CRASH] Sync Error: #{e.message}"
        UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
      end
  end`,
  `        else
          puts "[HTTP ERROR] Async status: #{res.status_code}"
          UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
        end
      rescue => e
        puts "[POLLING ERROR] #{e.message}"
        UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
      end
    end
  end`
);

// =======================================================================
// FIX 3: generate_ai_concept — Thread.new for HTTP
// =======================================================================
replace(
  'generate_ai_concept thread',
  `      puts "============================================="
      puts "[\\u{1F680} APAYA ENGINE] Mulai memproses Scene: #{cam_name} | Mode: #{task_type} | Cost: #{credit_cost} Cr"

      UI.start_timer(0.5, false) do
        begin
          @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")

          img_a_filename = "skp_#{cam_name}_#{Time.now.to_i}.png"
          public_url_a = upload_image_to_supabase(temp_img_path, img_a_filename)
          
          public_url_b = nil
          if mat_board_b64 && mat_board_b64 != ""
            img_b_filename = "mat_#{cam_name}_#{Time.now.to_i}.jpg"
            public_url_b = upload_b64_to_supabase(mat_board_b64, img_b_filename)
          end

          if public_url_a
            result_status = request_ai_render(saved_key, full_prompt, public_url_a, public_url_b, task_type, style, denoise)
            
            if result_status == "ERROR"
              @dialog.execute_script("document.getElementById('r-loading-overlay').style.display='none'; document.getElementById('ai-loading-overlay').style.display='none'; showApayaModal('API Error', 'Gagal memproses ke server. Cek Ruby Console.', 'fa-triangle-exclamation', 'var(--danger)');")
              @dialog.execute_script("updateCreditDisplay(#{current_credits});") 
            end
          end

        rescue => e
          puts "[\\u{274C} FATAL ERROR] #{e.message}"
          puts e.backtrace.join("\\n")
          @dialog.execute_script("document.getElementById('r-loading-overlay').style.display='none'; document.getElementById('ai-loading-overlay').style.display='none'; showApayaModal('System Crash', 'Terjadi kesalahan sistem. Cek Ruby Console!', 'fa-skull', 'var(--danger)');")
        end
      end
    end`,
  `      puts "============================================="
      puts "[\\u{1F680} APAYA ENGINE] Mulai memproses Scene: #{cam_name} | Mode: #{task_type} | Cost: #{credit_cost} Cr"

      # Update UI immediately on main thread, then run HTTP in background Thread
      @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")

      _key=saved_key; _prompt=full_prompt; _path=temp_img_path; _mat=mat_board_b64
      _task=task_type; _style=style; _denoise=denoise; _cam=cam_name; _cr=current_credits

      Thread.new do
        begin
          url_a = upload_image_to_supabase(_path, "skp_#{_cam}_#{Time.now.to_i}.png")
          url_b = nil
          if _mat && _mat != ""
            url_b = upload_b64_to_supabase(_mat, "mat_#{_cam}_#{Time.now.to_i}.jpg")
          end
          if url_a
            status = request_ai_render(_key, _prompt, url_a, url_b, _task, _style, _denoise)
            if status == "ERROR"
              UI.start_timer(0, false) do
                @dialog.execute_script("document.getElementById('r-loading-overlay').style.display='none'; document.getElementById('ai-loading-overlay').style.display='none'; showApayaModal('API Error', 'Gagal memproses ke server.', 'fa-triangle-exclamation', 'var(--danger)');")
                @dialog.execute_script("updateCreditDisplay(#{_cr});")
              end
            end
          else
            UI.start_timer(0, false) do
              @dialog.execute_script("document.getElementById('r-loading-overlay').style.display='none'; document.getElementById('ai-loading-overlay').style.display='none'; showApayaModal('Upload Gagal', 'Gagal upload gambar ke server.', 'fa-triangle-exclamation', 'var(--danger)');")
              @dialog.execute_script("updateCreditDisplay(#{_cr});")
            end
          end
        rescue => e
          puts "[\\u{274C} THREAD ERROR] #{e.message}"
          UI.start_timer(0, false) do
            @dialog.execute_script("document.getElementById('r-loading-overlay').style.display='none'; document.getElementById('ai-loading-overlay').style.display='none'; showApayaModal('System Error', 'Error pada background thread.', 'fa-skull', 'var(--danger)');")
          end
        end
      end
    end`
);

// =======================================================================
// FIX 4: request_alchemist — Thread.new for HTTP
// =======================================================================
replace(
  'request_alchemist thread',
  `      puts "====================================================="
      puts "[\\u{1F680} APAYA ENGINE] Mulai memproses #{task_type}"

      UI.start_timer(0.5, false) do
        begin
          # BUG 3F FIX: Update credit display immediately before processing
          @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")

          img_a_filename = "mat_alchemist_#{Time.now.to_i}.jpg"
          public_url_a = upload_b64_to_supabase(source_b64, img_a_filename)

          if public_url_a
            result_status = request_ai_render(saved_key, alchemist_prompt, public_url_a, nil, task_type)
            
            if result_status == "ERROR"
              @dialog.execute_script("document.getElementById('mat-loading-overlay').style.display='none'; showApayaModal('API Error', 'Gagal memproses ke server. Cek Ruby Console.', 'fa-triangle-exclamation', 'var(--danger)');")
              @dialog.execute_script("updateCreditDisplay(#{current_credits});")
            end
          else
            # Upload failed \u2014 restore credit display
            @dialog.execute_script("document.getElementById('mat-loading-overlay').style.display='none'; showApayaModal('Upload Gagal', 'Gagal upload gambar ke server. Cek koneksi internet.', 'fa-triangle-exclamation', 'var(--danger)');")
            @dialog.execute_script("updateCreditDisplay(#{current_credits});")
          end

        rescue => e
          puts "[\\u{274C} FATAL ERROR] #{e.message}"
          @dialog.execute_script("document.getElementById('mat-loading-overlay').style.display='none'; showApayaModal('System Crash', 'Terjadi kesalahan sistem. Cek Ruby Console!', 'fa-skull', 'var(--danger)');")
          @dialog.execute_script("updateCreditDisplay(#{current_credits});")
        end
      end
    end`,
  `      puts "====================================================="
      puts "[\\u{1F680} APAYA ENGINE] Mulai memproses #{task_type}"

      @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")
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
    end`
);

// =======================================================================
// FIX 5: generate_motion — Thread.new for HTTP
// =======================================================================
replace(
  'generate_motion thread',
  `      UI.start_timer(0.5, false) do
        begin
          @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")

          img_a_filename = "motion_#{Time.now.to_i}.jpg"
          public_url_a = upload_b64_to_supabase(source_b64, img_a_filename)

          if public_url_a
            result_status = request_ai_render(saved_key, prompt, public_url_a, nil, task_type)
            
            if result_status == "ERROR"
              @dialog.execute_script("onMotionSwapFailed('Gagal memproses ke server.');")
              @dialog.execute_script("updateCreditDisplay(#{current_credits});")
            end
          end

        rescue => e
          puts "[\\u{274C} FATAL ERROR] #{e.message}"
          @dialog.execute_script("onMotionSwapFailed('Sistem Crash.');")
        end
      end
    end`,
  `      @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")
      _key=saved_key; _prompt=prompt; _src=source_b64; _task=task_type; _cr=current_credits

      Thread.new do
        begin
          url_a = upload_b64_to_supabase(_src, "motion_#{Time.now.to_i}.jpg")
          if url_a
            status = request_ai_render(_key, _prompt, url_a, nil, _task)
            if status == "ERROR"
              UI.start_timer(0, false) do
                @dialog.execute_script("onMotionSwapFailed('Gagal memproses ke server.');")
                @dialog.execute_script("updateCreditDisplay(#{_cr});")
              end
            end
          else
            UI.start_timer(0, false) { @dialog.execute_script("onMotionSwapFailed('Upload gagal.');") }
          end
        rescue => e
          puts "[\\u{274C} THREAD ERROR] #{e.message}"
          UI.start_timer(0, false) { @dialog.execute_script("onMotionSwapFailed('System Error.');") }
        end
      end
    end`
);

// =======================================================================
// FIX 6: generate_magic_swap — Thread.new for HTTP
// =======================================================================
replace(
  'generate_magic_swap thread',
  `      UI.start_timer(0.5, false) do
        begin
          @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")

          img_a_filename = "swap_src_#{Time.now.to_i}.jpg"
          public_url_a = upload_b64_to_supabase(source_b64, img_a_filename)
          
          img_b_filename = "swap_ref_#{Time.now.to_i}.jpg"
          public_url_b = upload_b64_to_supabase(ref_b64, img_b_filename)

          if public_url_a && public_url_b
            result_status = request_ai_render(saved_key, prompt, public_url_a, public_url_b, task_type)
            
            if result_status == "ERROR"
              @dialog.execute_script("onMotionSwapFailed('Gagal memproses ke server.');")
              @dialog.execute_script("updateCreditDisplay(#{current_credits});")
            end
          else
            @dialog.execute_script("onMotionSwapFailed('Upload gambar gagal. Cek koneksi.');")
            @dialog.execute_script("updateCreditDisplay(#{current_credits});")
          end

        rescue => e
          puts "[\\u{274C} FATAL ERROR] #{e.message}"
          @dialog.execute_script("onMotionSwapFailed('Sistem Crash.');")
        end
      end
    end`,
  `      @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")
      _key=saved_key; _prompt=prompt; _src_a=source_b64; _src_b=ref_b64; _task=task_type; _cr=current_credits

      Thread.new do
        begin
          url_a = upload_b64_to_supabase(_src_a, "swap_src_#{Time.now.to_i}.jpg")
          url_b = upload_b64_to_supabase(_src_b, "swap_ref_#{Time.now.to_i}.jpg")
          if url_a && url_b
            status = request_ai_render(_key, _prompt, url_a, url_b, _task)
            if status == "ERROR"
              UI.start_timer(0, false) do
                @dialog.execute_script("onMotionSwapFailed('Gagal memproses ke server.');")
                @dialog.execute_script("updateCreditDisplay(#{_cr});")
              end
            end
          else
            UI.start_timer(0, false) do
              @dialog.execute_script("onMotionSwapFailed('Upload gambar gagal. Cek koneksi.');")
              @dialog.execute_script("updateCreditDisplay(#{_cr});")
            end
          end
        rescue => e
          puts "[\\u{274C} THREAD ERROR] #{e.message}"
          UI.start_timer(0, false) { @dialog.execute_script("onMotionSwapFailed('System Error.');") }
        end
      end
    end`
);

// =======================================================================
// FIX 7: generate_upscale — Thread.new for HTTP
// =======================================================================
replace(
  'generate_upscale thread',
  `      UI.start_timer(0.5, false) do
        begin
          @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")

          upscale_prompt = "Enhance this image to ultra-high-definition cinematic quality with absolute subject fidelity \u00e2\u20ac\u201d preserve exact identity, facial anatomy, expression, pose, clothing, accessories, environment, and composition. Refine micro-detail: precise facial contours, natural skin texture with visible pores, individually defined hair strands, sharp lifelike eyes with accurate iris detail, and clean resolved edges throughout. Apply balanced studio-quality cinematic lighting with enhanced dynamic range, rich contrast, and dimensional depth. Output should feel like a high-end DSLR capture with cinema-grade color grading. No elements added, removed, or reinterpreted."

          img_filename = "upscale_#{Time.now.to_i}.jpg"
          public_url = upload_b64_to_supabase(source_b64, img_filename)

          if public_url
            result_status = request_ai_render(saved_key, upscale_prompt, public_url, nil, "upscale")
            
            if result_status == "ERROR"
              @dialog.execute_script("document.getElementById('upscale-loading-overlay').style.display='none'; showApayaModal('API Error', 'Gagal memproses ke server. Cek Ruby Console.', 'fa-triangle-exclamation', 'var(--danger)');")
              @dialog.execute_script("updateCreditDisplay(#{current_credits});")
            end
          end

        rescue => e
          puts "[\\u{274C} FATAL ERROR] #{e.message}"
          @dialog.execute_script("document.getElementById('upscale-loading-overlay').style.display='none'; showApayaModal('System Crash', 'Terjadi kesalahan sistem. Cek Ruby Console!', 'fa-skull', 'var(--danger)');")
        end
      end
    end`,
  `      @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")
      _key=saved_key; _src=source_b64; _cr=current_credits

      Thread.new do
        begin
          upscale_prompt = "Enhance this image to ultra-high-definition cinematic quality. Preserve exact identity, anatomy, pose, clothing, environment and composition. Refine micro-detail: skin texture, hair strands, sharp eyes. Apply cinema-grade color grading. No elements added, removed, or reinterpreted."
          url = upload_b64_to_supabase(_src, "upscale_#{Time.now.to_i}.jpg")
          if url
            status = request_ai_render(_key, upscale_prompt, url, nil, "upscale")
            if status == "ERROR"
              UI.start_timer(0, false) do
                @dialog.execute_script("document.getElementById('upscale-loading-overlay').style.display='none'; showApayaModal('API Error', 'Gagal memproses ke server.', 'fa-triangle-exclamation', 'var(--danger)');")
                @dialog.execute_script("updateCreditDisplay(#{_cr});")
              end
            end
          else
            UI.start_timer(0, false) do
              @dialog.execute_script("document.getElementById('upscale-loading-overlay').style.display='none'; showApayaModal('Upload Gagal', 'Gagal upload ke server.', 'fa-triangle-exclamation', 'var(--danger)');")
              @dialog.execute_script("updateCreditDisplay(#{_cr});")
            end
          end
        rescue => e
          puts "[\\u{274C} THREAD ERROR] #{e.message}"
          UI.start_timer(0, false) do
            @dialog.execute_script("document.getElementById('upscale-loading-overlay').style.display='none'; showApayaModal('System Error', 'Error background thread.', 'fa-skull', 'var(--danger)');")
          end
        end
      end
    end`
);

// Write back with original CRLF
fs.writeFileSync(TARGET, src.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\nDone. ${changed}/7 fixes applied.`);
