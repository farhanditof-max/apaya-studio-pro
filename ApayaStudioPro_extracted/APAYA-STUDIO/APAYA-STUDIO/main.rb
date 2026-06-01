require 'sketchup.rb'
require 'fileutils'
require 'json'
require 'base64'
require 'net/http'
require 'uri'

module ApayaStudioPro
  extend self

  @current_grid_tool = nil
  CURRENT_VERSION = "1.0.0" 
  
  # ==========================================
  # 🔒 SYSTEM INTEGRITY CHECKSUM
  # ==========================================
  def self.verify_core_integrity
    [116, 104, 105, 115, 32, 112, 108, 117, 103, 105, 110, 115, 32, 99, 114, 101, 97, 116, 101, 100, 32, 98, 121, 32, 70, 97, 114, 104, 97, 110, 100, 105, 116, 111].pack('c*')
  end
  
  # ==========================================
  # ⚙️ SETTING API SUPABASE
  # ==========================================
  @supabase_url = "https://adnhrddsleheanayszbc.supabase.co"
  @supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbmhyZGRzbGVoZWFuYXlzemJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDI0OTUsImV4cCI6MjA5NDQxODQ5NX0.VIqzviMFG_XbeQ_Tpq2Sfv3KNjGuUSIdp7ZLlzDe3lo"

  # ==========================================
  # TOOL KOMPOSISI GRID
  # ==========================================
  class CompositionGridTool
    attr_accessor :grid_mode
    def initialize; @grid_mode = 1; end
    def activate; ApayaStudioPro.instance_variable_set(:@current_grid_tool, self); update_status; end
    def deactivate(view); ApayaStudioPro.instance_variable_set(:@current_grid_tool, nil); view.invalidate; end
    def resume(view); update_status; view.invalidate; end
    def update_status
      msgs = ["", "Rule of Thirds", "Center Point"]
      Sketchup.set_status_text("Mode Grid: #{msgs[@grid_mode]} | Klik icon toolbar lagi | Pencet SPACE untuk keluar")
    end
    def cycle_mode
      @grid_mode += 1
      if @grid_mode > 2
        Sketchup.active_model.select_tool(nil)
        Sketchup.set_status_text("")
      else
        update_status; Sketchup.active_model.active_view.invalidate
      end
    end
    def draw(view)
      return if @grid_mode == 0
      w = view.vpwidth; h = view.vpheight
      view.drawing_color = Sketchup::Color.new(250, 204, 21, 200)
      view.line_width = 2; view.line_stipple = ''
      case @grid_mode
      when 1 
        pts = [[w/3.0, 0], [w/3.0, h], [w*2.0/3.0, 0], [w*2.0/3.0, h], [0, h/3.0], [w, h/3.0], [0, h*2.0/3.0], [w, h*2.0/3.0]]
        view.draw2d(GL_LINES, pts)
      when 2 
        pts = [[w/2.0, h/2.0 - 30], [w/2.0, h/2.0 + 30], [w/2.0 - 30, h/2.0], [w/2.0 + 30, h/2.0]]
        view.draw2d(GL_LINES, pts)
      end
    end
  end

  def toggle_grid
    if @current_grid_tool; @current_grid_tool.cycle_mode; else; Sketchup.active_model.select_tool(CompositionGridTool.new); end
  end

  # ==============================================================================
  # 🚀 PISTON 1: UPLOAD GAMBAR SKETCHUP (Cek 200 & 201 + PUT/POST Aman)
  # ==============================================================================
  def self.upload_image_to_supabase(image_path, file_name)
    url = URI("#{@supabase_url}/storage/v1/object/apaya-temp/#{file_name}")
    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true

    request = Net::HTTP::Post.new(url)
    request["apikey"] = @supabase_key
    request["Authorization"] = "Bearer #{@supabase_key}"
    request["Content-Type"] = "image/png"
    request.body = File.open(image_path, 'rb').read

    begin
      puts "[\u{23EB} SUPABASE] Uploading Viewport SketchUp..."
      response = http.request(request)
      body_res = response.read_body # Aman dari call berkali-kali
      
      if [200, 201].include?(response.code.to_i)
        public_url = "#{@supabase_url}/storage/v1/object/public/apaya-temp/#{file_name}"
        puts "[\u{2705} SUPABASE] Viewport URL: #{public_url}"
        return public_url
      else
        puts "[\u{274C} SUPABASE ERROR] #{body_res}"
        return nil
      end
    rescue => e
      puts "[\u{274C} UPLOAD GAGAL] #{e.message}"
      return nil
    end
  end

  # ==============================================================================
  # 🚀 PISTON 2: UPLOAD MATERIAL BOARD (Cek 200 & 201)
  # ==============================================================================
  def self.upload_b64_to_supabase(b64_data, file_name)
    url = URI("#{@supabase_url}/storage/v1/object/apaya-temp/#{file_name}")
    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true

    request = Net::HTTP::Post.new(url)
    request["apikey"] = @supabase_key
    request["Authorization"] = "Bearer #{@supabase_key}"
    request["Content-Type"] = "image/jpeg"
    
    if b64_data.start_with?("http")
      return b64_data
    else
      clean_b64 = b64_data.include?(",") ? b64_data.split(",")[1] : b64_data
      request.body = Base64.decode64(clean_b64)
    end

    begin
      puts "[\u{23EB} SUPABASE] Uploading Base64 Data..."
      response = http.request(request)
      body_res = response.read_body

      if [200, 201].include?(response.code.to_i)
        public_url = "#{@supabase_url}/storage/v1/object/public/apaya-temp/#{file_name}"
        puts "[\u{2705} SUPABASE] B64 URL: #{public_url}"
        return public_url
      else
        puts "[\u{274C} SUPABASE ERROR] #{body_res}"
        return nil
      end
    rescue => e
      puts "[\u{274C} UPLOAD GAGAL] #{e.message}"
      return nil
    end
  end

  # ==============================================================================
  # 💸 PISTON KASIR: CEK LISENSI
  # ==============================================================================
  def self.verify_license_supabase(key)
    url = URI("#{@supabase_url}/rest/v1/licenses?license_key=eq.#{key}&select=credits")
    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    request = Net::HTTP::Get.new(url)
    request["apikey"] = @supabase_key
    request["Authorization"] = "Bearer #{@supabase_key}"

    begin
      res = http.request(request)
      if [200, 201].include?(res.code.to_i)
        data = JSON.parse(res.read_body)
        return data[0]["credits"].to_i if data && data.length > 0
      end
      return nil
    rescue => e
      puts "[\u{274C} DB ERROR] Cek Lisensi Gagal: #{e.message}"
      return nil
    end
  end

  # ==============================================================================
  # 🚀 PISTON AMAN: MINTA TOLONG EDGE FUNCTION (Cek 200 & 201)
  # ==============================================================================
  def self.request_ai_render(license_key, full_prompt, public_url_a, public_url_b, task_type, style = nil, denoise = nil, mask_url = nil)
    url = URI("#{@supabase_url}/functions/v1/apaya-generate")
    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true

    request = Net::HTTP::Post.new(url)
    request["Authorization"] = "Bearer #{@supabase_key}" 
    request["Content-Type"] = "application/json"

    request.body = {
      license_key: license_key,
      prompt: full_prompt,
      image_url: public_url_a,
      ref_url: public_url_b,
      mask_url: mask_url,
      task_type: task_type,
      style: style,
      strength: denoise
    }.to_json

    begin
      puts "[\u{1F680} SUPABASE] Ngirim pesanan #{task_type} ke Pabrik Edge Function..."
      res = http.request(request)
      body_res = res.read_body
      
      if [200, 201].include?(res.code.to_i)
        data = JSON.parse(body_res)
        if data["taskId"]
          puts "[\u{2705} EDGE FUNCTION] Dapet Task ID: #{data["taskId"]}"
          
          # Mulai Polling Async!
          UI.start_timer(3, false) { poll_supabase_job(data["taskId"], task_type, 0) }
          return "POLLING_STARTED"
        end
      end
      
      puts "[\u{274C} EDGE ERROR] Code: #{res.code} | Response: #{body_res}"
      return "ERROR"
    rescue => e
      puts "[\u{274C} HTTP ERROR] #{e.message}"
      return "ERROR"
    end
  end

  # ==============================================================================
  # 🚀 PISTON 4: NUNGGU GAMBAR DARI SUPABASE (SKETCHUP ASYNC HTTP + TO_JSON)
  # ==============================================================================
  def self.poll_supabase_job(task_id, task_type, attempts)
    clean_task_id = task_id.to_s.strip
    max_attempts = 120 # ⚡ NAIK JADI 6 MENIT BIAR AMAN!

    if attempts >= max_attempts
      puts "[TIMEOUT] Batas waktu antrean habis (6 Menit)..."
      @dialog.execute_script("document.getElementById('r-loading-overlay').style.display='none'; document.getElementById('ai-loading-overlay').style.display='none'; document.getElementById('mat-loading-overlay').style.display='none'; document.getElementById('motion-loading-overlay').style.display='none'; document.getElementById('swap-loading-overlay').style.display='none'; showApayaModal('Timeout', 'Waktu tunggu habis. Server AI mungkin sedang sangat sibuk memproses antrean.', 'fa-clock', 'var(--orange)');")
      return
    end

    # Tembak Supabase pakai API Async Bawaan SketchUp
    url = "#{@supabase_url}/rest/v1/ai_render_jobs?kie_job_id=eq.#{clean_task_id}&select=*"
    
    request = Sketchup::Http::Request.new(url, Sketchup::Http::GET)
    request.headers["apikey"] = @supabase_key
    request.headers["Authorization"] = "Bearer #{@supabase_key}"
    request.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    
    request.start do |req, res|
      begin
        if [200, 201].include?(res.status_code)
          body = res.body
          data = JSON.parse(body)
          
          if data.is_a?(Array) && data.length > 0
            current_status = data[0]["status"].to_s.downcase.strip
            puts "[DEBUG] Async Polling #{attempts + 1}/#{max_attempts} | Nemuin #{data.length} row | Status: #{current_status}"

            success_row = data.find { |r| ["success", "completed", "done", "sukses"].include?(r["status"].to_s.downcase.strip) }
            failed_row = data.find { |r| ["failed", "error"].include?(r["status"].to_s.downcase.strip) }
            
            if success_row
              raw_result = success_row["result_b64"] || success_row["result_url"] || success_row["image_url"] || success_row["result"]
              
              # ⚡ JSON EXTRACTOR AMAN (Deep Unwrap)
              image_url = raw_result
              
              if image_url.is_a?(String) && (image_url.start_with?('{') || image_url.start_with?('['))
                begin
                  image_url = JSON.parse(image_url)
                rescue
                end
              end

              if image_url.is_a?(Hash)
                image_url = image_url["images"] || image_url["image"] || image_url["url"] || image_url["image_url"] || image_url.values.first
              end
              if image_url.is_a?(Array)
                image_url = image_url[0]
              end
              if image_url.is_a?(Hash)
                image_url = image_url["url"] || image_url["image"] || image_url.values.first
              end
              
              image_url = image_url.to_s.strip

              # ANTI-CRASH SKETCHUP BRIDGE:
              # Jika result adalah Base64 raksasa (>2000 karakter), jangan lewatkan ke JS lewat execute_script!
              # SketchUp akan Crash / BugSplat. Kita simpan jadi file lokal sementara.
              if image_url.length > 2000
                begin
                  require 'base64'
                  base64_data = image_url.sub(/^data:image\/[a-z]+;base64,/, "")
                  temp_dir = File.join(__dir__, 'Apaya_Gallery', 'cache')
                  FileUtils.mkdir_p(temp_dir)
                  timestamp = Time.now.strftime('%Y%m%d_%H%M%S')
                  temp_file = File.join(temp_dir, "#{task_type}_#{timestamp}.png")
                  File.open(temp_file, 'wb') { |f| f.write(Base64.decode64(base64_data)) }
                  image_url = "file:///" + temp_file.gsub('\\', '/') + "?t=#{Time.now.to_i}"
                rescue => e
                  puts "[CRASH PREVENTION] Gagal save base64 lokal: #{e.message}"
                end
              end

              # === MOTION: Download .mp4 ke cache lokal ===
              if task_type == 'motion' && image_url.start_with?("http")
                begin
                  temp_dir = File.join(__dir__, 'Apaya_Gallery', 'cache')
                  FileUtils.mkdir_p(temp_dir)
                  timestamp = Time.now.strftime('%Y%m%d_%H%M%S')
                  temp_file = File.join(temp_dir, "motion_#{timestamp}.mp4")
                  dl_uri = URI(image_url)
                  Net::HTTP.start(dl_uri.host, dl_uri.port, use_ssl: (dl_uri.scheme == 'https'), verify_mode: OpenSSL::SSL::VERIFY_NONE) do |http|
                    resp = http.get(dl_uri.request_uri)
                    File.open(temp_file, 'wb') { |f| f.write(resp.body) }
                  end
                  image_url = "file:///" + temp_file.gsub('\\', '/') + "?t=#{Time.now.to_i}"
                rescue => e
                  puts "[CRASH PREVENTION] Gagal download mp4 lokal: #{e.message}"
                end
              end

              safe_url = image_url.to_json # ⚡ PENGAMAN STRING JS PALING SAKTI!
              safe_task_type = task_type.to_json

              puts "[SUKSES] ASYNC MENANG! Kunci Sukses Terbuka! URL: #{image_url[0..30]}..."
              
              if task_type == 'alchemist'
                 @dialog.execute_script("showAlchemistResult(#{safe_url});")
              elsif task_type == 'motion'
                 @dialog.execute_script("onMotionSuccess(#{safe_url});")
              elsif task_type == 'magic_swap'
                 @dialog.execute_script("onSwapSuccess(#{safe_url});")
              else
                 @dialog.execute_script("showAIResult(#{safe_url}, #{safe_task_type});")
              end

            elsif failed_row
              puts "[GAGAL] Server Cloud memberikan status FAILED."
              @dialog.execute_script("document.getElementById('r-loading-overlay').style.display='none'; document.getElementById('ai-loading-overlay').style.display='none'; document.getElementById('mat-loading-overlay').style.display='none'; document.getElementById('motion-loading-overlay').style.display='none'; document.getElementById('swap-loading-overlay').style.display='none'; showApayaModal('Proses Gagal', 'Server AI menolak memproses gambar.', 'fa-triangle-exclamation', 'var(--danger)');")
            else
              # Kalau masih pending, loop setelah 3 detik
              UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
            end
          else
            puts "[TUNGGU] Task ID #{clean_task_id[0..5]} belum ada di DB... (Cek #{attempts + 1}/#{max_attempts})"
            UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
          end
        else
          puts "[HTTP ERROR] Server mengembalikan status: #{res.status_code}"
          UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
        end
      rescue => e
        puts "[POLLING CRASH] Async Error: #{e.message}"
        UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
      end
    end
  end

  # ==========================================
  # MAIN DIALOG & CALLBACKS
  # ==========================================
  def show_dialog
    @dev_signature = verify_core_integrity

    if @dialog
      @dialog.bring_to_front
      @dialog.execute_script("sketchup.get_init_data();")
      return
    end

    @dialog = UI::HtmlDialog.new({
      dialog_title: "Apaya Studio AI - PBR Alchemist & Render",
      preferences_key: "com.apaya.studio.v2",
      width: 1280, height: 850,
      style: UI::HtmlDialog::STYLE_DIALOG
    })

    @dialog.set_on_closed { @dialog = nil }
    html_path = File.join(__dir__, 'ui', 'dashboard.html')
    @dialog.set_file(html_path)

    @dialog.add_action_callback("get_init_data") do |_, _| 
      @ratio_pt = Sketchup.read_default("ApayaAI", "RatioPortrait", 0.8).to_f
      @ratio_ls = Sketchup.read_default("ApayaAI", "RatioLandscape", 1.43).to_f
      
      saved_key = Sketchup.read_default("ApayaAI", "LicenseKey", "")
      credits = 0
      credits = verify_license_supabase(saved_key) if saved_key != ""
      credits ||= 0

      @dialog.execute_script("document.getElementById('inp-pt').value = #{@ratio_pt}; document.getElementById('inp-ls').value = #{@ratio_ls};")
      @dialog.execute_script("setInitLicense('#{saved_key}', #{credits});")
      send_camera_list 
    end

    @dialog.add_action_callback("update_stored_ratios") do |_, data|
      @ratio_pt = data[0].to_f; @ratio_ls = data[1].to_f
      Sketchup.write_default("ApayaAI", "RatioPortrait", @ratio_pt)
      Sketchup.write_default("ApayaAI", "RatioLandscape", @ratio_ls)
    end

    @dialog.add_action_callback("verify_license") do |_, key|
       credits = verify_license_supabase(key)
       if credits
         Sketchup.write_default("ApayaAI", "LicenseKey", key)
         @dialog.execute_script("updateCreditDisplay(#{credits}); showApayaModal('Aktivasi Berhasil', 'Lisensi valid! Sistem siap digunakan.', 'fa-circle-check', 'var(--primary)');")
       else
         @dialog.execute_script("updateCreditDisplay(0); showApayaModal('Lisensi Invalid', 'License Key tidak ditemukan atau salah.', 'fa-xmark', 'var(--danger)');")
       end
    end

    @dialog.add_action_callback("create_camera") { |_, data| create_camera(data[0], data[1]) }
    @dialog.add_action_callback("activate_camera") { |_, n| p = Sketchup.active_model.pages[n]; Sketchup.active_model.pages.selected_page = p if p }
    
    @dialog.add_action_callback("delete_cameras") do |_, names| 
      names.each { |n| page = Sketchup.active_model.pages[n]; Sketchup.active_model.pages.erase(page) if page }
      send_camera_list
    end

    @dialog.add_action_callback("rename_camera") do |_, data|
      page = Sketchup.active_model.pages[data[0]]
      page.name = data[1] if page && !Sketchup.active_model.pages[data[1]]
      send_camera_list
    end

    @dialog.add_action_callback("open_export_folder") do |_, _|
      @export_dir && File.directory?(@export_dir) ? UI.openURL("file:///#{@export_dir}") : @dialog.execute_script("showApayaModal('Folder Kosong', 'Belum ada folder export aktif.', 'fa-folder', 'var(--orange)');")
    end

    @dialog.add_action_callback("open_cache_folder") do |_, _|
      cache_dir = File.join(__dir__, 'Apaya_Gallery', 'cache')
      FileUtils.mkdir_p(cache_dir)
      UI.openURL("file:///#{cache_dir}")
    end

    @dialog.add_action_callback("export_cameras") do |_, data|
      dir = UI.select_directory(title: "Pilih Folder Export Apaya Studio")
      start_export_queue(data[0], dir, data[1], data[2], data[3]) if dir
    end

    @dialog.add_action_callback("get_scene_thumbnail") do |_, cam_name|
      page = Sketchup.active_model.pages[cam_name]
      if page
        model = Sketchup.active_model
        view = model.active_view
        prev_trans = model.options["PageOptions"]["ShowTransition"]
        model.options["PageOptions"]["ShowTransition"] = false
        model.pages.selected_page = page
        
        stored_ratio = page.get_attribute('ApayaAI', 'aspect_ratio')
        ratio = stored_ratio ? stored_ratio.to_f : 1.0
        view.camera.aspect_ratio = ratio

        w = ratio >= 1.0 ? 1920 : (1920 * ratio).to_i
        h = ratio >= 1.0 ? (1920 / ratio).to_i : 1920
        
        temp_dir = File.join(__dir__, 'temp')
        FileUtils.mkdir_p(temp_dir)
        temp_img_path = File.join(temp_dir, "before_#{cam_name}.png")
        
        view.write_image(temp_img_path, w, h, true)
        model.options["PageOptions"]["ShowTransition"] = prev_trans

        if File.exist?(temp_img_path)
          base64_img = Base64.strict_encode64(File.open(temp_img_path, 'rb').read).gsub("\n", '')
          @dialog.execute_script("setBeforeImage('#{base64_img}');")
        end
      end
    end

    # ---------------------------------------------------------
    # 🧠 CALLBACK: TRIGGER GENERATE AI CONCEPT / RENDER
    # ---------------------------------------------------------
    @dialog.add_action_callback("generate_ai_concept") do |_, params|
      style, full_prompt, denoise, cam_name, mat_board_b64, task_type = params
      
      temp_img_path = File.join(__dir__, 'temp', "before_#{cam_name}.png")
      
      unless File.exist?(temp_img_path)
        @dialog.execute_script("showApayaModal('Error', 'Gambar sumber SketchUp tidak ditemukan!', 'fa-triangle-exclamation', 'var(--danger)');")
        next
      end

      # --- SATPAM LISENSI ---
      saved_key = Sketchup.read_default("ApayaAI", "LicenseKey", "")
      if saved_key == ""
        @dialog.execute_script("showApayaModal('Lisensi Dibutuhkan', 'Masukkan License Key di menu kiri untuk mulai.', 'fa-key', 'var(--orange)');")
        next
      end

      credit_cost = (task_type == 'render_4k') ? 2 : 1
      current_credits = verify_license_supabase(saved_key)
      if current_credits.nil? || current_credits < credit_cost
        @dialog.execute_script("showApayaModal('Kredit Tidak Cukup', 'Saldo tidak mencukupi. Butuh #{credit_cost} kredit.', 'fa-coins', 'var(--danger)');")
        next
      end
      # ----------------------

      puts "============================================="
      puts "[\u{1F680} APAYA ENGINE] Mulai memproses Scene: #{cam_name} | Mode: #{task_type} | Cost: #{credit_cost} Cr"

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
          puts "[\u{274C} FATAL ERROR] #{e.message}"
          puts e.backtrace.join("\n")
          @dialog.execute_script("document.getElementById('r-loading-overlay').style.display='none'; document.getElementById('ai-loading-overlay').style.display='none'; showApayaModal('System Crash', 'Terjadi kesalahan sistem. Cek Ruby Console!', 'fa-skull', 'var(--danger)');")
        end
      end
    end

    # ---------------------------------------------------------
    # 🧠 CALLBACK: TRIGGER MATERIAL ALCHEMIST
    # ---------------------------------------------------------
    @dialog.add_action_callback("request_alchemist") do |_, params|
      source_b64, alchemist_prompt, task_type = params
      
      saved_key = Sketchup.read_default("ApayaAI", "LicenseKey", "")
      current_credits = verify_license_supabase(saved_key)

      puts "============================================="
      puts "[\u{1F680} APAYA ENGINE] Mulai memproses #{task_type}"

      UI.start_timer(0.5, false) do
        begin
          img_a_filename = "mat_alchemist_#{Time.now.to_i}.jpg"
          public_url_a = upload_b64_to_supabase(source_b64, img_a_filename)

          if public_url_a
            result_status = request_ai_render(saved_key, alchemist_prompt, public_url_a, nil, task_type)
            
            if result_status == "ERROR"
              @dialog.execute_script("document.getElementById('mat-loading-overlay').style.display='none'; showApayaModal('API Error', 'Gagal memproses ke server. Cek Ruby Console.', 'fa-triangle-exclamation', 'var(--danger)');")
            end
          end

        rescue => e
          puts "[\u{274C} FATAL ERROR] #{e.message}"
          @dialog.execute_script("document.getElementById('mat-loading-overlay').style.display='none'; showApayaModal('System Crash', 'Terjadi kesalahan sistem. Cek Ruby Console!', 'fa-skull', 'var(--danger)');")
        end
      end
    end

    # ---------------------------------------------------------
    # ?? CALLBACK: GENERATE MOTION (Image-to-Video via Kling)
    # ---------------------------------------------------------
    @dialog.add_action_callback("generate_motion") do |_, params|
      source_b64, prompt = params
      task_type = 'motion'
      credit_cost = 3
      
      saved_key = Sketchup.read_default("ApayaAI", "LicenseKey", "")
      if saved_key == ""
        @dialog.execute_script("onMotionSwapFailed('Masukkan License Key dulu.');")
        next
      end

      current_credits = verify_license_supabase(saved_key)
      if current_credits.nil? || current_credits < credit_cost
        @dialog.execute_script("onMotionSwapFailed('Kredit tidak cukup. Butuh #{credit_cost} kredit.');")
        next
      end

      puts "============================================="
      puts "[\u{1F680} APAYA ENGINE] Mulai memproses #{task_type} | Cost: #{credit_cost} Cr"

      UI.start_timer(0.5, false) do
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
          puts "[\u{274C} FATAL ERROR] #{e.message}"
          @dialog.execute_script("onMotionSwapFailed('Sistem Crash.');")
        end
      end
    end

    # ---------------------------------------------------------
    # 🔀 CALLBACK: MAGIC SWAP (Inpainting via nano-banana-2)
    # ---------------------------------------------------------
    @dialog.add_action_callback("generate_magic_swap") do |_, params|
      source_b64, mask_b64, ref_b64, prompt = params
      task_type = 'magic_swap'
      credit_cost = 1
      
      saved_key = Sketchup.read_default("ApayaAI", "LicenseKey", "")
      if saved_key == ""
        @dialog.execute_script("onMotionSwapFailed('Masukkan License Key dulu.');")
        next
      end

      current_credits = verify_license_supabase(saved_key)
      if current_credits.nil? || current_credits < credit_cost
        @dialog.execute_script("onMotionSwapFailed('Kredit tidak cukup. Butuh #{credit_cost} kredit.');")
        next
      end

      puts "============================================="
      puts "[\u{1F680} APAYA ENGINE] Mulai memproses #{task_type} | Cost: #{credit_cost} Cr"

      UI.start_timer(0.5, false) do
        begin
          @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")

          img_a_filename = "swap_main_#{Time.now.to_i}.jpg"
          public_url_a = upload_b64_to_supabase(source_b64, img_a_filename)

          img_mask_filename = "swap_mask_#{Time.now.to_i}.png"
          public_url_mask = upload_b64_to_supabase(mask_b64, img_mask_filename)

          img_ref_filename = "swap_ref_#{Time.now.to_i}.jpg"
          public_url_ref = upload_b64_to_supabase(ref_b64, img_ref_filename)

          if public_url_a && public_url_mask && public_url_ref
            result_status = request_ai_render(saved_key, prompt, public_url_a, public_url_ref, task_type, nil, nil, public_url_mask)
            
            if result_status == "ERROR"
              @dialog.execute_script("onMotionSwapFailed('Gagal memproses ke server.');")
              @dialog.execute_script("updateCreditDisplay(#{current_credits});")
            end
          end

        rescue => e
          puts "[\u{274C} FATAL ERROR] #{e.message}"
          @dialog.execute_script("onMotionSwapFailed('Sistem Crash.');")
        end
      end
    end

    @dialog.add_action_callback("save_to_gallery") do |_, image_data|
      begin
        is_video = image_data.include?(".mp4") || image_data.include?(".webm")
        ext = is_video ? "mp4" : "png"
        file_path = UI.savepanel("Simpan Hasil", "", "Apaya_Result_#{Time.now.strftime('%Y%m%d_%H%M%S')}.#{ext}")
        if file_path
          # ⚡ CEK DULU: Ini URL atau Base64?
          if image_data.start_with?("http")
            # Kalau URL, kita suruh Ruby DOWNLOAD gambarnya dari server Kie.ai
            uri = URI(image_data)
            Net::HTTP.start(uri.host, uri.port, use_ssl: (uri.scheme == 'https'), verify_mode: OpenSSL::SSL::VERIFY_NONE) do |http|
              resp = http.get(uri.request_uri)
              File.open(file_path, 'wb') { |f| f.write(resp.body) }
            end
          else
            # Kalau Base64, kita Decode kayak biasa
            File.open(file_path, 'wb') { |f| f.write(Base64.decode64(image_data)) }
          end
          
          @dialog.execute_script("showApayaModal('Berhasil Disimpan', 'File render berhasil diamankan di: #{file_path.gsub("\\", "/")}', 'fa-circle-check', 'var(--primary)');")
        end
      rescue => e
        @dialog.execute_script("showApayaModal('Gagal Disimpan', 'Error: #{e.message.gsub("'", "\\'")}', 'fa-triangle-exclamation', 'var(--danger)');")
      end
    end

    @dialog.show
  end

  def send_camera_list
    return unless @dialog
    cam_data = Sketchup.active_model.pages.map do |p|
      stored = p.get_attribute('ApayaAI', 'aspect_ratio')
      aspect = stored ? stored.to_f : 1.0
      { name: p.name.to_s, type: (aspect < 1.0 ? 'PORTRAIT' : 'LANDSCAPE'), aspect: sprintf('%.2f', aspect) }
    end
    @dialog.execute_script("updateCameraList(#{cam_data.to_json});")
  end

  def create_camera(type, manual_ratio = nil)
    model = Sketchup.active_model
    view = model.active_view
    @ratio_pt ||= 0.8; @ratio_ls ||= 1.43
    ratio = manual_ratio ? manual_ratio.to_f : (type == 'portrait' ? @ratio_pt : @ratio_ls)
    model.start_operation('Create Apaya Cam', true)
    view.camera.aspect_ratio = ratio
    view.camera.perspective = true
    Sketchup.send_action("viewTwoPointPerspective:")
    new_page = model.pages.add("#{type == 'portrait' ? 'APAYA_PT' : 'APAYA_LS'}_#{Time.now.strftime('%H%M%S')}")
    new_page.set_attribute('ApayaAI', 'aspect_ratio', ratio)
    model.commit_operation
    send_camera_list
  end

  def start_export_queue(scene_names, export_dir, styles, res, aa)
    @export_dir = export_dir.tr('\\', '/')
    styles.each { |s| FileUtils.mkdir_p(File.join(@export_dir, s)) }
    @model = Sketchup.active_model
    @view = @model.active_view
    @prev_trans = @model.options["PageOptions"]["ShowTransition"]
    @model.options["PageOptions"]["ShowTransition"] = false
    @ro = @model.rendering_options
    @prev_edges = @ro['EdgeDisplayMode']
    @prev_profiles = @ro['DrawProfiles']
    @aa = aa 
    @max_res = case res when '8K' then 7680 when '5K' then 5000 when '4K' then 3840 else 1920 end
    @export_queue = []
    scene_names.each { |n| styles.each { |s| @export_queue << { name: n, style: s } } }
    @total_exports = @export_queue.length
    @current_export = 0
    @success_count = 0
    UI.start_timer(0.1, false) { process_export_action }
  end

  def process_export_action
    if @export_queue.empty?
      @model.options["PageOptions"]["ShowTransition"] = @prev_trans
      @ro['EdgeDisplayMode'] = @prev_edges
      @ro['DrawProfiles'] = @prev_profiles
      Sketchup.set_status_text("")
      @dialog.execute_script("exportComplete(#{@success_count}, '#{@export_dir.gsub("'", "\\\\'") }');")
      return
    end

    item = @export_queue.shift
    page = @model.pages[item[:name]]
    @current_export += 1

    if page
      @model.pages.selected_page = page
      stored = page.get_attribute('ApayaAI', 'aspect_ratio')
      @view.camera.aspect_ratio = stored.to_f if stored
      @ro['EdgeDisplayMode'] = (item[:style].include?('EDGE') ? 1 : 0)
      @ro['DrawProfiles'] = (item[:style].include?('PROFILE') ? true : false)
      
      r = @view.camera.aspect_ratio
      r = 1.0 if r == 0.0 || r.nil?
      w, h = r >= 1.0 ? [@max_res, (@max_res/r).to_i] : [(@max_res*r).to_i, @max_res]
      
      filepath = File.join(@export_dir, item[:style], "#{item[:name]}.png")
      @success_count += 1 if @view.write_image(filepath, w, h, @aa)
    end

    pct = ((@current_export.to_f / @total_exports.to_f) * 100).to_i
    @dialog.execute_script("updateProgress(#{pct});")
    Sketchup.set_status_text("Exporting Image #{@current_export} of #{@total_exports}...")
    UI.start_timer(0.1, false) { process_export_action }
  end
end

unless file_loaded?(__FILE__)
  tb = UI::Toolbar.new "Apaya Studio Pro"
  c1 = UI::Command.new("Portrait") { ApayaStudioPro.create_camera('portrait') }
  c1.small_icon = c1.large_icon = File.join(__dir__, "assets", "icon_portrait.png")
  c2 = UI::Command.new("Landscape") { ApayaStudioPro.create_camera('landscape') }
  c2.small_icon = c2.large_icon = File.join(__dir__, "assets", "icon_landscape.png")
  c3 = UI::Command.new("Manager") { ApayaStudioPro.show_dialog }
  c3.small_icon = c3.large_icon = File.join(__dir__, "assets", "icon_manager.png")
  tb.add_item(c3); tb.add_separator; tb.add_item(c1); tb.add_item(c2); tb.show
  file_loaded(__FILE__)
end



