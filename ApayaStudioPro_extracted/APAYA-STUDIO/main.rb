require 'sketchup.rb'
require 'fileutils'
require 'json'
require 'base64'
require 'net/http'
require 'uri'
require 'zlib'
require 'stringio'


module ApayaStudioPro
  extend self

  def self.safe_body(res)
    return "" if res.nil? || res.body.nil?
    body = res.body
    is_gzip = false
    begin
      is_gzip = (body.length >= 2 && body.getbyte(0) == 0x1F && body.getbyte(1) == 0x8B)
    rescue
    end
    if is_gzip
      begin
        sio = StringIO.new(body)
        gz = Zlib::GzipReader.new(sio)
        body = gz.read
        gz.close
      rescue => e
        puts "[GZIP ERROR] Failed to decompress: #{e.message}"
      end
    end
    body.to_s.encode('UTF-8', invalid: :replace, undef: :replace, replace: '?')
  end

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
  # TOOL KOMPOSISI GRID (9 MODE)
  # ==========================================
  class CompositionGridTool
    attr_accessor :grid_mode
    def initialize; @grid_mode = 1; end
    def activate; ApayaStudioPro.instance_variable_set(:@current_grid_tool, self); update_status; end
    def deactivate(view); ApayaStudioPro.instance_variable_set(:@current_grid_tool, nil); view.invalidate; end
    def resume(view); update_status; view.invalidate; end
    def update_status
      msgs = ["", "Rule of Thirds", "Center Point", "Golden Ratio", "4x4 Grid", "Golden Spiral (Top-Left)", "Golden Spiral (Top-Right)", "Golden Spiral (Bottom-Left)", "Golden Spiral (Bottom-Right)", "Cross"]
      Sketchup.set_status_text("Mode Grid: #{msgs[@grid_mode]} | Pencet SPACE untuk keluar")
    end
    def cycle_mode
      @grid_mode += 1
      if @grid_mode > 9
        Sketchup.active_model.select_tool(nil)
        Sketchup.set_status_text("")
      else
        update_status; Sketchup.active_model.active_view.invalidate
      end
    end
    def draw(view)
      return if @grid_mode == 0
      sf = get_safe_frame(view)
      x = sf[:x]; y = sf[:y]; w = sf[:w]; h = sf[:h]
      view.drawing_color = Sketchup::Color.new(250, 204, 21, 255)
      view.line_width = 2; view.line_stipple = ''
      case @grid_mode
      when 1
        pts = [[x+w/3.0,y],[x+w/3.0,y+h],[x+w*2.0/3.0,y],[x+w*2.0/3.0,y+h],[x,y+h/3.0],[x+w,y+h/3.0],[x,y+h*2.0/3.0],[x+w,y+h*2.0/3.0]]
        view.draw2d(GL_LINES, pts)
      when 2
        pts = [[x+w/2.0,y+h/2.0-40],[x+w/2.0,y+h/2.0+40],[x+w/2.0-40,y+h/2.0],[x+w/2.0+40,y+h/2.0]]
        view.draw2d(GL_LINES, pts)
      when 3
        phi = 0.61803398875; inv = 1.0 - phi
        pts = [[x+w*inv,y],[x+w*inv,y+h],[x+w*phi,y],[x+w*phi,y+h],[x,y+h*inv],[x+w,y+h*inv],[x,y+h*phi],[x+w,y+h*phi]]
        view.draw2d(GL_LINES, pts)
      when 4
        pts = [[x+w*0.25,y],[x+w*0.25,y+h],[x+w*0.5,y],[x+w*0.5,y+h],[x+w*0.75,y],[x+w*0.75,y+h],[x,y+h*0.25],[x+w,y+h*0.25],[x,y+h*0.5],[x+w,y+h*0.5],[x,y+h*0.75],[x+w,y+h*0.75]]
        view.draw2d(GL_LINES, pts)
      when 5 then draw_golden_spiral(view, x, y, w, h, 0)
      when 6 then draw_golden_spiral(view, x, y, w, h, 1)
      when 7 then draw_golden_spiral(view, x, y, w, h, 2)
      when 8 then draw_golden_spiral(view, x, y, w, h, 3)
      when 9
        pts = [[x,y],[x+w,y+h],[x+w,y],[x,y+h]]
        view.draw2d(GL_LINES, pts)
      end
    end
    def draw_golden_spiral(view, x, y, w, h, orientation=0)
      phi = 1.6180339887; b = Math.log(phi) / (Math::PI / 2.0)
      pts = []
      (-120..20).each do |i|
        theta = i * (Math::PI / 20.0); r = Math.exp(b * theta)
        pts << [r * Math.cos(theta), r * Math.sin(theta)]
      end
      min_x = pts.map{|p| p[0]}.min; max_x = pts.map{|p| p[0]}.max
      min_y = pts.map{|p| p[1]}.min; max_y = pts.map{|p| p[1]}.max
      sw = max_x - min_x; sh = max_y - min_y
      scale_x = w / sw; scale_y = h / sh
      final_pts = pts.map do |p|
        nx = (p[0] - min_x) * scale_x; ny = (p[1] - min_y) * scale_y
        nx = w - nx if orientation == 1 || orientation == 3
        ny = h - ny if orientation == 2 || orientation == 3
        [x + nx, y + ny]
      end
      view.draw2d(GL_LINE_STRIP, final_pts) if final_pts.any?
    end
    def get_safe_frame(view)
      vp_w = view.vpwidth.to_f; vp_h = view.vpheight.to_f
      cam_ratio = view.camera.aspect_ratio
      return { x: 0, y: 0, w: vp_w, h: vp_h } if cam_ratio == 0.0 || cam_ratio.nil?
      vp_ratio = vp_w / vp_h
      if vp_ratio > cam_ratio
        safe_w = vp_h * cam_ratio; safe_h = vp_h; offset_x = (vp_w - safe_w) / 2.0; offset_y = 0
      else
        safe_w = vp_w; safe_h = vp_w / cam_ratio; offset_x = 0; offset_y = (vp_h - safe_h) / 2.0
      end
      { x: offset_x, y: offset_y, w: safe_w, h: safe_h }
    end
  end

  def toggle_grid
    if @current_grid_tool; @current_grid_tool.cycle_mode; else; Sketchup.active_model.select_tool(CompositionGridTool.new); end
  end

  # ==========================================
  # 📦 SCENE DATA (SIMPAN PER-SCENE)
  # ==========================================
  module SceneData
    extend self
    def save_attribute(key, value)
      page = Sketchup.active_model.pages.selected_page
      page.set_attribute('ApayaStudioPro', key, value) if page
    end
    def get_attribute(key, default_value = nil)
      page = Sketchup.active_model.pages.selected_page
      return default_value unless page
      val = page.get_attribute('ApayaStudioPro', key)
      val.nil? ? default_value : val
    end
  end

  # ==========================================
  # 📷 CAMERA CONTROL (FOV, CLIP, RESET)
  # ==========================================
  module CameraControl
    extend self
    def update_fov(val)
      cam = Sketchup.active_model.active_view.camera
      cam.fov = val.to_f
      SceneData.save_attribute('fov', val.to_f)
    end
    def reset_rotation
      view = Sketchup.active_model.active_view
      cam = view.camera
      eye = cam.eye; target = cam.target
      horiz_target = Geom::Point3d.new(target.x, target.y, eye.z)
      cam.set(eye, horiz_target, [0, 0, 1])
      cam.perspective = true
      view.camera = cam; view.invalidate
    end
    def update_clipping(val)
      model = Sketchup.active_model
      cam = model.active_view.camera
      model.start_operation("Clip", true)
      model.rendering_options['DisplaySectionCuts'] = true
      model.rendering_options['DisplaySectionPlanes'] = false
      sp = model.active_entities.grep(Sketchup::SectionPlane).find { |s| s.name == "APAYA_CLIP" }
      if val.to_f <= 0
        model.active_entities.erase_entities(sp) if sp
      else
        model.active_entities.erase_entities(sp) if sp
        cut_p = cam.eye.offset(cam.direction, val.to_f.cm)
        new_sp = model.active_entities.add_section_plane([cut_p, cam.direction])
        new_sp.name = "APAYA_CLIP"
        new_sp.activate
      end
      model.commit_operation
      SceneData.save_attribute('clip', val.to_f)
      model.active_view.invalidate
    end
  end

  # ==========================================
  # 🎛️ CAMERA CONTROL UI (HTMLDIALOG)
  # ==========================================
  @cam_dialog = nil
  def self.show_camera_control
    if @cam_dialog && @cam_dialog.visible?; @cam_dialog.bring_to_front; return; end
    @cam_dialog = UI::HtmlDialog.new(dialog_title: "Camera Control", preferences_key: "ApayaCamCtrl", width: 280, height: 280, resizable: false, style: UI::HtmlDialog::STYLE_UTILITY)
    html = <<~HTML
      <!DOCTYPE html><html><head><style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',sans-serif;background:#1a1a2e;color:#e0e0e0;padding:15px}
        .control{margin-bottom:18px}
        .label-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
        label{font-size:11px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:.5px}
        input[type=number]{width:60px;background:#0f0f23;color:#FACC15;border:1px solid #333;border-radius:4px;font-size:12px;text-align:center;padding:4px;outline:none;font-weight:bold}
        input[type=number]:focus{border-color:#FACC15}
        input[type=range]{width:100%;cursor:pointer;accent-color:#FACC15}
        .reset-btn{width:100%;padding:8px;background:#FACC15;color:#000;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:1px;transition:.2s}
        .reset-btn:hover{background:#fbbf24;transform:translateY(-1px)}.reset-btn:active{transform:scale(.98)}
      </style></head><body>
        <div class="control"><div class="label-row"><label>FOV (Field of View)</label><input type="number" id="inp-fov" value="35" min="10" max="120" step="1" onchange="syncFov(this.value)"></div>
        <input type="range" id="slider-fov" min="10" max="120" value="35" oninput="document.getElementById('inp-fov').value=this.value; sketchup.update_fov(this.value)"></div>
        <div class="control"><div class="label-row"><label>Clip Distance (cm)</label><input type="number" id="inp-clip" value="0" min="0" max="5000" step="10" onchange="syncClip(this.value)"></div>
        <input type="range" id="slider-clip" min="0" max="2000" value="0" oninput="document.getElementById('inp-clip').value=this.value; sketchup.update_clip(this.value)"></div>
        <button class="reset-btn" onclick="sketchup.reset_rotation()">⟳ Reset Camera Rotation</button>
        <script>
          function syncFov(v){document.getElementById('slider-fov').value=v;sketchup.update_fov(v)}
          function syncClip(v){document.getElementById('slider-clip').value=v;sketchup.update_clip(v)}
          function updateUI(fov,clip){if(fov!=null){document.getElementById('inp-fov').value=fov;document.getElementById('slider-fov').value=fov}if(clip!=null){document.getElementById('inp-clip').value=clip;document.getElementById('slider-clip').value=clip}}
        </script>
      </body></html>
    HTML
    @cam_dialog.set_html(html)
    @cam_dialog.add_action_callback("update_fov") { |_, v| CameraControl.update_fov(v) }
    @cam_dialog.add_action_callback("update_clip") { |_, v| CameraControl.update_clipping(v) }
    @cam_dialog.add_action_callback("reset_rotation") { |_, _| CameraControl.reset_rotation }
    @cam_dialog.show
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
    request["Accept-Encoding"] = "identity"
    request["Accept-Encoding"] = "identity"
    request["Content-Type"] = "image/png"
    request["Accept-Encoding"] = "identity"
    request.body = File.open(image_path, 'rb').read

    begin
      puts "[\u{23EB} SUPABASE] Uploading Viewport SketchUp..."
      response = http.request(request)
      body_res = self.safe_body(response) # Aman dari call berkali-kali
      
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
    request["Accept-Encoding"] = "identity"
    request["Accept-Encoding"] = "identity"
    request["Content-Type"] = "image/jpeg"
    request["Accept-Encoding"] = "identity"
    
    if b64_data.start_with?("http")
      return b64_data
    else
      clean_b64 = b64_data.include?(",") ? b64_data.split(",")[1] : b64_data
      request.body = Base64.decode64(clean_b64)
    end

    begin
      puts "[\u{23EB} SUPABASE] Uploading Base64 Data..."
      response = http.request(request)
      body_res = self.safe_body(response)

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
  def self.fetch_remote_config
    puts "[CONFIG DIAGNOSTIC] URL: #{@supabase_url}"
    puts "[CONFIG DIAGNOSTIC] Key Length: #{@supabase_key.to_s.length}"
    puts "[CONFIG DIAGNOSTIC] Key Start: #{@supabase_key.to_s[0..9]}... End: #{@supabase_key.to_s[-10..-1]}"

    url = URI("#{@supabase_url}/rest/v1/app_settings?id=eq.1&select=*")
    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    request = Net::HTTP::Get.new(url)
    request["apikey"] = @supabase_key
    request["Authorization"] = "Bearer #{@supabase_key}"
    request["Accept-Encoding"] = "identity"
    request["Accept-Encoding"] = "identity"

    begin
      res = http.request(request)
      raw_body = res.body.to_s
      hex_bytes = raw_body.unpack('C*').map { |c| "%02X" % c }.join(' ')
      puts "[CONFIG] HTTP #{res.code} | Raw Bytes: #{hex_bytes}"
      
      body = self.safe_body(res)
      puts "[CONFIG] HTTP #{res.code} | Body: #{body}"
      if [200, 201].include?(res.code.to_i)
        data = JSON.parse(body) rescue nil
        if data && data.is_a?(Array) && data.length > 0
          row = data[0]
          show_claim = (row['show_claim_button'] == true || row['show_claim_button'].to_s == 'true')
          enable_ai  = (row['enable_ai_features'] == true  || row['enable_ai_features'].to_s  == 'true')
          wa_number  = row['whatsapp_number'].to_s.strip
          wa_number  = "+62 857-4245-3372" if wa_number.empty?
          puts "[CONFIG OK] show_claim=#{show_claim} | enable_ai=#{enable_ai} | wa_number=#{wa_number}"
          return { 'show_claim_button' => show_claim, 'enable_ai_features' => enable_ai, 'whatsapp_number' => wa_number }
        else
          puts "[CONFIG WARN] Data kosong atau nil"
        end
      end
    rescue => e
      err_msg = e.message.to_s.encode('UTF-8', invalid: :replace, undef: :replace, replace: '?')
      puts "[CONFIG ERROR] #{err_msg}"
    end

    return { 'show_claim_button' => false, 'enable_ai_features' => false, 'whatsapp_number' => '+62 857-4245-3372' }
  end

  def self.verify_license_supabase(key)
    url = URI("#{@supabase_url}/rest/v1/licenses?license_key=eq.#{key}&select=credits")
    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    request = Net::HTTP::Get.new(url)
    request["apikey"] = @supabase_key
    request["Authorization"] = "Bearer #{@supabase_key}"
    request["Accept-Encoding"] = "identity"
    request["Accept-Encoding"] = "identity"

    begin
      res = http.request(request)
      if [200, 201].include?(res.code.to_i)
        data = JSON.parse(self.safe_body(res))
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
    request["Accept-Encoding"] = "identity"
    request["Accept-Encoding"] = "identity" 
    request["Content-Type"] = "application/json"
    request["Accept-Encoding"] = "identity"

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
      body_res = self.safe_body(res)
      
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
              elsif task_type == 'upscale'
                 @dialog.execute_script("showUpscaleResult(#{safe_url});")
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

      config = fetch_remote_config
      puts "[🔧 REMOTE CONFIG] show_claim=#{config['show_claim_button']} | enable_ai=#{config['enable_ai_features']} | wa_number=#{config['whatsapp_number']}"
      config_json = "{\"show_claim_button\":#{config['show_claim_button']},\"enable_ai_features\":#{config['enable_ai_features']},\"whatsapp_number\":\"#{config['whatsapp_number']}\"}"
      @dialog.execute_script("applyRemoteConfig(#{config_json});")


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

    # ---------------------------------------------------------
    # 🔍 CALLBACK: TRIGGER UPSCALE 4K
    # ---------------------------------------------------------
    @dialog.add_action_callback("generate_upscale") do |_, params|
      source_b64 = params[0]
      
      saved_key = Sketchup.read_default("ApayaAI", "LicenseKey", "")
      if saved_key == ""
        @dialog.execute_script("showApayaModal('Lisensi Dibutuhkan', 'Masukkan License Key di menu kiri untuk mulai.', 'fa-key', 'var(--orange)');")
        next
      end

      credit_cost = 2
      current_credits = verify_license_supabase(saved_key)
      if current_credits.nil? || current_credits < credit_cost
        @dialog.execute_script("showApayaModal('Kredit Tidak Cukup', 'Saldo tidak mencukupi. Butuh #{credit_cost} kredit.', 'fa-coins', 'var(--danger)');")
        next
      end

      puts "============================================="
      puts "[\u{1F680} APAYA ENGINE] Mulai Upscale 4K | Cost: #{credit_cost} Cr"

      UI.start_timer(0.5, false) do
        begin
          @dialog.execute_script("updateCreditDisplay(#{current_credits - credit_cost});")

          upscale_prompt = "Enhance this image to ultra-high-definition cinematic quality with absolute subject fidelity — preserve exact identity, facial anatomy, expression, pose, clothing, accessories, environment, and composition. Refine micro-detail: precise facial contours, natural skin texture with visible pores, individually defined hair strands, sharp lifelike eyes with accurate iris detail, and clean resolved edges throughout. Apply balanced studio-quality cinematic lighting with enhanced dynamic range, rich contrast, and dimensional depth. Output should feel like a high-end DSLR capture with cinema-grade color grading. No elements added, removed, or reinterpreted."

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
          puts "[\u{274C} FATAL ERROR] #{e.message}"
          @dialog.execute_script("document.getElementById('upscale-loading-overlay').style.display='none'; showApayaModal('System Crash', 'Terjadi kesalahan sistem. Cek Ruby Console!', 'fa-skull', 'var(--danger)');")
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
  c1.tooltip = "Create Portrait Camera"
  c2 = UI::Command.new("Landscape") { ApayaStudioPro.create_camera('landscape') }
  c2.small_icon = c2.large_icon = File.join(__dir__, "assets", "icon_landscape.png")
  c2.tooltip = "Create Landscape Camera"
  c3 = UI::Command.new("Manager") { ApayaStudioPro.show_dialog }
  c3.small_icon = c3.large_icon = File.join(__dir__, "assets", "logo_apaya.png")
  c3.tooltip = "Open Apaya Studio Manager"
  c4 = UI::Command.new("Camera Control") { ApayaStudioPro.show_camera_control }
  c4.small_icon = c4.large_icon = File.join(__dir__, "assets", "icon_cam_control.png")
  c4.tooltip = "Camera Control (FOV, Clip, Reset)"
  c5 = UI::Command.new("Composition Grid") { ApayaStudioPro.toggle_grid }
  c5.small_icon = c5.large_icon = File.join(__dir__, "assets", "icon_composition.png")
  c5.tooltip = "Composition Grid (9 modes)"
  tb.add_item(c3); tb.add_separator; tb.add_item(c1); tb.add_item(c2); tb.add_separator; tb.add_item(c4); tb.add_item(c5); tb.show
  file_loaded(__FILE__)
end



