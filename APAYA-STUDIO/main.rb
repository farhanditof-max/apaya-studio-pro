require 'sketchup.rb'
require 'fileutils'
require 'json'
require 'base64'
require 'net/http'
require 'uri'
require 'zlib'
require 'stringio'
require_relative 'lib/config'
require_relative 'lib/infrastructure/supabase_client'
require_relative 'lib/infrastructure/image_url_extractor'
require_relative 'lib/infrastructure/result_cache'
require_relative 'lib/infrastructure/polling_manager'
require_relative 'lib/infrastructure/license_manager'
require_relative 'lib/infrastructure/storage_client'
require_relative 'lib/infrastructure/ai_client'
require_relative 'lib/infrastructure/remote_config'
require_relative 'lib/domain/scene_data'
require_relative 'lib/domain/composition_grid'
require_relative 'lib/domain/camera'
require_relative 'lib/domain/export_job'
require_relative 'lib/interface/ui_gateway'
require_relative 'lib/interface/camera_dialog'


module ApayaStudioPro
  extend self
  include UiGateway

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
  # ⚙️ KONFIGURASI SUPABASE
  # ==========================================
  # Anon key didistribusikan bersama plugin (.rbz) — ini desain yang disengaja.
  # Plugin berjalan embedded di SketchUp (client-side), tidak ada server secret store.
  # Keamanan ditegakkan via Row Level Security (RLS) di Supabase, bukan lewat menyembunyikan key.
  # Override key: Sketchup.write_default("ApayaAI", "SupabaseKey", "key-baru")
  # Rotation policy: setiap 12 bulan atau jika dicurigai bocor.
  module ApayaConfig
    extend self

    SUPABASE_URL = "https://adnhrddsleheanayszbc.supabase.co".freeze
    # frozen_string_literal: anon key — public by design, protected by RLS
    SUPABASE_KEY_DEFAULT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbmhyZGRzbGVoZWFuYXlzemJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDI0OTUsImV4cCI6MjA5NDQxODQ5NX0.VIqzviMFG_XbeQ_Tpq2Sfv3KNjGuUSIdp7ZLlzDe3lo".freeze

    def supabase_url
      SUPABASE_URL
    end

    def supabase_key
      override = Sketchup.read_default("ApayaAI", "SupabaseKey", "")
      override.empty? ? SUPABASE_KEY_DEFAULT : override
    end
  end

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
  # ==============================================================================
  # UPLOAD GAMBAR SKETCHUP ke Supabase Storage
  # ==============================================================================
  def self.upload_image_to_supabase(image_path, file_name)
    puts "[⬆ SUPABASE] Uploading Viewport SketchUp..."
    res = SupabaseClient.upload(
      "/storage/v1/object/apaya-temp/#{file_name}",
      File.binread(image_path),
      'image/png'
    )
    return nil unless res && [200, 201].include?(res.code.to_i)
    public_url = "#{ApayaConfig.supabase_url}/storage/v1/object/public/apaya-temp/#{file_name}"
    puts "[✅ SUPABASE] Viewport URL: #{public_url}"
    public_url
  rescue => e
    puts "[❌ UPLOAD GAGAL] #{e.message}"
    nil
  end

  # ==============================================================================
  # UPLOAD BASE64 IMAGE ke Supabase Storage
  # ==============================================================================
  def self.upload_b64_to_supabase(b64_data, file_name)
    return b64_data if b64_data.start_with?('http')
    clean_b64 = b64_data.include?(',') ? b64_data.split(',')[1] : b64_data
    puts "[⬆ SUPABASE] Uploading Base64 Data..."
    res = SupabaseClient.upload(
      "/storage/v1/object/apaya-temp/#{file_name}",
      Base64.decode64(clean_b64),
      'image/jpeg'
    )
    return nil unless res && [200, 201].include?(res.code.to_i)
    public_url = "#{ApayaConfig.supabase_url}/storage/v1/object/public/apaya-temp/#{file_name}"
    puts "[✅ SUPABASE] B64 URL: #{public_url}"
    public_url
  rescue => e
    puts "[❌ UPLOAD GAGAL] #{e.message}"
    nil
  end

  # ==============================================================================
  # 💸 PISTON KASIR: CEK LISENSI
  # ==============================================================================
  def self.fetch_remote_config
    res = SupabaseClient.get('/rest/v1/app_settings?id=eq.1&select=*')
    if res && [200, 201].include?(res.code.to_i)
      data = JSON.parse(safe_body(res)) rescue nil
      if data.is_a?(Array) && !data.empty?
        row        = data[0]
        show_claim = [true, 'true'].include?(row['show_claim_button'])
        enable_ai  = [true, 'true'].include?(row['enable_ai_features'])
        wa_number  = row['whatsapp_number'].to_s.strip
        wa_number  = '+62 857-4245-3372' if wa_number.empty?
        puts "[CONFIG OK] show_claim=#{show_claim} | enable_ai=#{enable_ai}"
        return { 'show_claim_button' => show_claim, 'enable_ai_features' => enable_ai, 'whatsapp_number' => wa_number }
      end
    end
    default_remote_config
  rescue => e
    puts "[CONFIG ERROR] #{e.message.encode('UTF-8', invalid: :replace, undef: :replace, replace: '?')}"
    default_remote_config
  end

  def self.default_remote_config
    { 'show_claim_button' => false, 'enable_ai_features' => false, 'whatsapp_number' => '+62 857-4245-3372' }
  end

  def self.verify_license_supabase(key)
    res = SupabaseClient.post_json('/rest/v1/rpc/get_license_credits', { p_key: key.to_s })
    return nil unless res && [200, 201].include?(res.code.to_i)
    credits = JSON.parse(safe_body(res)) rescue nil
    credits&.to_i
  rescue => e
    puts "[❌ DB ERROR] Cek Lisensi Gagal: #{e.message}"
    nil
  end

  # ==============================================================================
  # TRIGGER AI RENDER via Edge Function
  # ==============================================================================
  def self.request_ai_render(license_key, full_prompt, public_url_a, public_url_b, task_type, style = nil, denoise = nil, mask_url = nil)
    puts "[🚀 SUPABASE] Ngirim pesanan #{task_type} ke Edge Function..."
    res = SupabaseClient.post_json('/functions/v1/apaya-generate', {
      license_key: license_key,
      prompt:      full_prompt,
      image_url:   public_url_a,
      ref_url:     public_url_b,
      mask_url:    mask_url,
      task_type:   task_type,
      style:       style,
      strength:    denoise
    })
    return 'ERROR' unless res && [200, 201].include?(res.code.to_i)
    data = JSON.parse(safe_body(res)) rescue nil
    return 'ERROR' unless data&.dig('taskId')
    puts "[✅ EDGE FUNCTION] Task ID: #{data['taskId']}"
    UI.start_timer(3, false) { poll_supabase_job(data['taskId'], task_type, 0) }
    'POLLING_STARTED'
  rescue => e
    puts "[❌ HTTP ERROR] #{e.message}"
    'ERROR'
  end

  # ==============================================================================
  # POLLING — delegasi ke PollingManager
  # ==============================================================================
  def self.poll_supabase_job(task_id, task_type, _attempts = 0)
    PollingManager.new(task_id, task_type, self).start
  end

  # ==========================================
  # MAIN DIALOG & CALLBACKS
  # ==========================================

  DIALOG_OPTIONS = {
    dialog_title:    'Apaya Studio AI - PBR Alchemist & Render',
    preferences_key: 'com.apaya.studio.v2',
    width: 1280, height: 850,
    style: UI::HtmlDialog::STYLE_DIALOG
  }.freeze

  def show_dialog
    if @dialog
      @dialog.bring_to_front
      trigger_init_data
      return
    end
    @dialog = build_dialog
    register_callbacks(@dialog)
    @dialog.show
  end

  def build_dialog
    d = UI::HtmlDialog.new(DIALOG_OPTIONS)
    d.set_on_closed { @dialog = nil }
    d.set_file(File.join(__dir__, 'ui', 'dashboard.html'))
    d
  end

  def register_callbacks(d)
    d.add_action_callback('get_init_data')       { |_, _| on_get_init_data }
    d.add_action_callback('update_stored_ratios') { |_, v| on_update_stored_ratios(v) }
    d.add_action_callback('verify_license')       { |_, k| on_verify_license(k) }
    d.add_action_callback('create_camera')        { |_, v| create_camera(v[0], v[1]) }
    d.add_action_callback('activate_camera')      { |_, n| on_activate_camera(n) }
    d.add_action_callback('delete_cameras')       { |_, ns| on_delete_cameras(ns) }
    d.add_action_callback('rename_camera')        { |_, v| on_rename_camera(v) }
    d.add_action_callback('open_export_folder')   { |_, _| on_open_export_folder }
    d.add_action_callback('open_cache_folder')    { |_, _| on_open_cache_folder }
    d.add_action_callback('export_cameras')       { |_, v| on_export_cameras(v) }
    d.add_action_callback('get_scene_thumbnail')  { |_, n| on_get_scene_thumbnail(n) }
    d.add_action_callback('generate_ai_concept')  { |_, p| on_generate_ai_concept(p) }
    d.add_action_callback('request_alchemist')    { |_, p| on_request_alchemist(p) }
    d.add_action_callback('generate_motion')      { |_, p| on_generate_motion(p) }
    d.add_action_callback('generate_magic_swap')  { |_, p| on_generate_magic_swap(p) }
    d.add_action_callback('generate_upscale')     { |_, p| on_generate_upscale(p) }
    d.add_action_callback('save_to_gallery')      { |_, v| on_save_to_gallery(v) }
  end

  def load_saved_license
    Sketchup.read_default('ApayaAI', 'LicenseKey', '')
  end

  # Guard: cek license + kredit. Return [key, credits] kalau valid, nil kalau blocked.
  def check_license(credit_cost)
    key = load_saved_license
    if key.empty?
      show_warning('Lisensi Dibutuhkan', 'Masukkan License Key di menu kiri untuk mulai.')
      return nil
    end
    credits = LicenseManager.verify(key)
    if credits.nil? || credits < credit_cost
      show_error('Kredit Tidak Cukup', "Saldo tidak mencukupi. Butuh #{credit_cost} kredit.")
      return nil
    end
    [key, credits]
  end

  def on_get_init_data
    @ratio_pt = Sketchup.read_default('ApayaAI', 'RatioPortrait', 0.8).to_f
    @ratio_ls = Sketchup.read_default('ApayaAI', 'RatioLandscape', 1.43).to_f
    saved_key = load_saved_license
    credits   = (saved_key.empty? ? 0 : LicenseManager.verify(saved_key)) || 0
    set_ratio_display(@ratio_pt, @ratio_ls)
    set_init_license(saved_key, credits)
    config = RemoteConfig.fetch
    puts "[🔧 REMOTE CONFIG] show_claim=#{config['show_claim_button']} | enable_ai=#{config['enable_ai_features']}"
    apply_remote_config(config)
    send_camera_list
  end

  def on_update_stored_ratios(data)
    @ratio_pt = data[0].to_f
    @ratio_ls = data[1].to_f
    Sketchup.write_default('ApayaAI', 'RatioPortrait', @ratio_pt)
    Sketchup.write_default('ApayaAI', 'RatioLandscape', @ratio_ls)
  end

  def on_verify_license(key)
    credits = LicenseManager.verify(key)
    if credits
      Sketchup.write_default('ApayaAI', 'LicenseKey', key)
      update_credit_display(credits)
      show_success('Aktivasi Berhasil', 'Lisensi valid! Sistem siap digunakan.')
    else
      update_credit_display(0)
      show_error('Lisensi Invalid', 'License Key tidak ditemukan atau salah.')
    end
  end

  def on_activate_camera(name)
    page = Sketchup.active_model.pages[name]
    Sketchup.active_model.pages.selected_page = page if page
  end

  def on_delete_cameras(names)
    names.each do |n|
      page = Sketchup.active_model.pages[n]
      Sketchup.active_model.pages.erase(page) if page
    end
    send_camera_list
  end

  def on_rename_camera(data)
    page = Sketchup.active_model.pages[data[0]]
    page.name = data[1] if page && !Sketchup.active_model.pages[data[1]]
    send_camera_list
  end

  def on_open_export_folder
    if @last_export_dir && File.directory?(@last_export_dir)
      UI.openURL("file:///#{@last_export_dir}")
    else
      show_warning('Folder Kosong', 'Belum ada folder export aktif.')
    end
  end

  def on_open_cache_folder
    cache_dir = File.join(__dir__, 'Apaya_Gallery', 'cache')
    FileUtils.mkdir_p(cache_dir)
    UI.openURL("file:///#{cache_dir}")
  end

  def on_export_cameras(data)
    dir = UI.select_directory(title: 'Pilih Folder Export Apaya Studio')
    start_export_queue(data[0], dir, data[1], data[2], data[3]) if dir
  end

  def on_get_scene_thumbnail(cam_name)
    page = Sketchup.active_model.pages[cam_name]
    return unless page
    model = Sketchup.active_model
    view  = model.active_view
    prev_trans = model.options['PageOptions']['ShowTransition']
    model.options['PageOptions']['ShowTransition'] = false
    model.pages.selected_page = page
    ratio = (page.get_attribute('ApayaAI', 'aspect_ratio') || 1.0).to_f
    view.camera.aspect_ratio = ratio
    w = ratio >= 1.0 ? 1920 : (1920 * ratio).to_i
    h = ratio >= 1.0 ? (1920 / ratio).to_i : 1920
    temp_dir = File.join(__dir__, 'temp')
    FileUtils.mkdir_p(temp_dir)
    temp_img_path = File.join(temp_dir, "before_#{cam_name}.png")
    view.write_image(temp_img_path, w, h, true)
    model.options['PageOptions']['ShowTransition'] = prev_trans
    return unless File.exist?(temp_img_path)
    b64 = Base64.strict_encode64(File.binread(temp_img_path)).gsub("\n", '')
    set_before_image(b64)
  end

  def on_generate_ai_concept(params)
    style, full_prompt, denoise, cam_name, mat_board_b64, task_type = params
    temp_img_path = File.join(__dir__, 'temp', "before_#{cam_name}.png")
    unless File.exist?(temp_img_path)
      show_error('Error', 'Gambar sumber SketchUp tidak ditemukan!')
      return
    end
    credit_cost = task_type == 'render_4k' ? 2 : 1
    result = check_license(credit_cost)
    return unless result
    key, credits = result
    puts "[🚀 APAYA ENGINE] Scene: #{cam_name} | Mode: #{task_type} | Cost: #{credit_cost} Cr"
    UI.start_timer(0.5, false) do
      begin
        update_credit_display(credits - credit_cost)
        public_url_a = StorageClient.upload_image(temp_img_path, "skp_#{cam_name}_#{Time.now.to_i}.png")
        public_url_b = nil
        if mat_board_b64 && !mat_board_b64.empty?
          public_url_b = StorageClient.upload_b64(mat_board_b64, "mat_#{cam_name}_#{Time.now.to_i}.jpg")
        end
        if public_url_a
          task_id = AiClient.request_render(key, full_prompt, public_url_a, public_url_b, task_type, style: style, denoise: denoise)
          if task_id == 'ERROR'
            hide_render_overlays
            show_error('API Error', 'Gagal memproses ke server. Cek Ruby Console.')
            update_credit_display(credits)
          else
            UI.start_timer(3, false) { PollingManager.new(task_id, task_type, self).start }
          end
        end
      rescue => e
        puts "[❌ FATAL ERROR] #{e.message}\n#{e.backtrace.first(3).join("\n")}"
        hide_render_overlays
        show_error('System Crash', 'Terjadi kesalahan sistem. Cek Ruby Console!')
      end
    end
  end

  def on_request_alchemist(params)
    source_b64, alchemist_prompt, task_type = params
    key = load_saved_license
    puts "[🚀 APAYA ENGINE] Alchemist: #{task_type}"
    UI.start_timer(0.5, false) do
      begin
        public_url_a = StorageClient.upload_b64(source_b64, "mat_alchemist_#{Time.now.to_i}.jpg")
        if public_url_a
          task_id = AiClient.request_render(key, alchemist_prompt, public_url_a, nil, task_type)
          if task_id == 'ERROR'
            hide_mat_overlay
            show_error('API Error', 'Gagal memproses ke server. Cek Ruby Console.')
          else
            UI.start_timer(3, false) { PollingManager.new(task_id, task_type, self).start }
          end
        end
      rescue => e
        puts "[❌ FATAL ERROR] #{e.message}"
        hide_mat_overlay
        show_error('System Crash', 'Terjadi kesalahan sistem. Cek Ruby Console!')
      end
    end
  end

  def on_generate_motion(params)
    source_b64, prompt = params
    result = check_license(3)
    return on_motion_swap_failed('Lisensi atau kredit tidak cukup.') unless result
    key, credits = result
    puts "[🚀 APAYA ENGINE] motion | Cost: 3 Cr"
    UI.start_timer(0.5, false) do
      begin
        update_credit_display(credits - 3)
        public_url_a = StorageClient.upload_b64(source_b64, "motion_#{Time.now.to_i}.jpg")
        if public_url_a
          task_id = AiClient.request_render(key, prompt, public_url_a, nil, 'motion')
          if task_id == 'ERROR'
            on_motion_swap_failed('Gagal memproses ke server.')
            update_credit_display(credits)
          else
            UI.start_timer(3, false) { PollingManager.new(task_id, 'motion', self).start }
          end
        end
      rescue => e
        puts "[❌ FATAL ERROR] #{e.message}"
        on_motion_swap_failed('Sistem Crash.')
      end
    end
  end

  def on_generate_magic_swap(params)
    raw_json  = params.is_a?(Array) ? params[0] : params
    parsed    = JSON.parse(raw_json)
    source_b64 = parsed['src']
    ref_b64    = parsed['ref']
    prompt     = parsed['prompt']
    result = check_license(1)
    return on_motion_swap_failed('Lisensi atau kredit tidak cukup.') unless result
    key, credits = result
    puts "[🚀 APAYA ENGINE] magic_swap | Cost: 1 Cr"
    UI.start_timer(0.5, false) do
      begin
        update_credit_display(credits - 1)
        public_url_a   = StorageClient.upload_b64(source_b64, "swap_main_#{Time.now.to_i}.jpg")
        public_url_ref = StorageClient.upload_b64(ref_b64,    "swap_ref_#{Time.now.to_i}.jpg")
        if public_url_a && public_url_ref
          task_id = AiClient.request_render(key, prompt, public_url_a, public_url_ref, 'magic_swap')
          if task_id == 'ERROR'
            on_motion_swap_failed('Gagal memproses ke server.')
            update_credit_display(credits)
          else
            UI.start_timer(3, false) { PollingManager.new(task_id, 'magic_swap', self).start }
          end
        end
      rescue => e
        puts "[❌ FATAL ERROR] #{e.message}"
        on_motion_swap_failed('Sistem Crash.')
      end
    end
  end

  def on_generate_upscale(params)
    source_b64  = params[0]
    result = check_license(2)
    return unless result
    key, credits = result
    upscale_prompt = 'Enhance this image to ultra-high-definition cinematic quality with absolute subject fidelity — preserve exact identity, facial anatomy, expression, pose, clothing, accessories, environment, and composition. Refine micro-detail: precise facial contours, natural skin texture with visible pores, individually defined hair strands, sharp lifelike eyes with accurate iris detail, and clean resolved edges throughout. Apply balanced studio-quality cinematic lighting with enhanced dynamic range, rich contrast, and dimensional depth. Output should feel like a high-end DSLR capture with cinema-grade color grading. No elements added, removed, or reinterpreted.'
    puts "[🚀 APAYA ENGINE] upscale 4K | Cost: 2 Cr"
    UI.start_timer(0.5, false) do
      begin
        update_credit_display(credits - 2)
        public_url = StorageClient.upload_b64(source_b64, "upscale_#{Time.now.to_i}.jpg")
        if public_url
          task_id = AiClient.request_render(key, upscale_prompt, public_url, nil, 'upscale')
          if task_id == 'ERROR'
            hide_upscale_overlay
            show_error('API Error', 'Gagal memproses ke server. Cek Ruby Console.')
            update_credit_display(credits)
          else
            UI.start_timer(3, false) { PollingManager.new(task_id, 'upscale', self).start }
          end
        end
      rescue => e
        puts "[❌ FATAL ERROR] #{e.message}"
        hide_upscale_overlay
        show_error('System Crash', 'Terjadi kesalahan sistem. Cek Ruby Console!')
      end
    end
  end

  def on_save_to_gallery(image_data)
    is_video  = image_data.include?('.mp4') || image_data.include?('.webm')
    ext       = is_video ? 'mp4' : 'png'
    file_path = UI.savepanel('Simpan Hasil', '', "Apaya_Result_#{Time.now.strftime('%Y%m%d_%H%M%S')}.#{ext}")
    return unless file_path
    begin
      if image_data.start_with?('http')
        uri = URI(image_data)
        Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') do |http|
          File.binwrite(file_path, http.get(uri.request_uri).body)
        end
      else
        File.binwrite(file_path, Base64.decode64(image_data))
      end
      show_success('Berhasil Disimpan', "File disimpan di: #{file_path.gsub('\\', '/')}")
    rescue => e
      show_error('Gagal Disimpan', "Error: #{e.message}")
    end
  end


  def send_camera_list
    return unless @dialog
    cam_data = Sketchup.active_model.pages.map do |p|
      stored = p.get_attribute('ApayaAI', 'aspect_ratio')
      aspect = stored ? stored.to_f : 1.0
      { name: p.name.to_s, type: (aspect < 1.0 ? 'PORTRAIT' : 'LANDSCAPE'), aspect: sprintf('%.2f', aspect) }
    end
    update_camera_list(cam_data)
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
    return if @export_job

    @export_job = ExportJob.new(scene_names, export_dir, styles, res, aa)
    @last_export_dir = @export_job.export_dir
    styles.each { |s| FileUtils.mkdir_p(File.join(@last_export_dir, s)) }

    model = Sketchup.active_model
    ro    = model.rendering_options
    @export_prev = {
      trans:    model.options["PageOptions"]["ShowTransition"],
      edges:    ro['EdgeDisplayMode'],
      profiles: ro['DrawProfiles']
    }
    model.options["PageOptions"]["ShowTransition"] = false

    UI.start_timer(0.1, false) { process_export_action }
  end

  def process_export_action
    return unless @export_job

    model = Sketchup.active_model
    ro    = model.rendering_options

    if @export_job.done?
      model.options["PageOptions"]["ShowTransition"] = @export_prev[:trans]
      ro['EdgeDisplayMode'] = @export_prev[:edges]
      ro['DrawProfiles']    = @export_prev[:profiles]
      Sketchup.set_status_text("")
      export_complete(@export_job.success_count, @export_job.export_dir)
      @export_job = nil
      return
    end

    item = @export_job.shift_item
    page = model.pages[item[:name]]

    if page
      model.pages.selected_page = page
      view   = model.active_view
      stored = page.get_attribute('ApayaAI', 'aspect_ratio')
      view.camera.aspect_ratio = stored.to_f if stored
      ro['EdgeDisplayMode'] = item[:style].include?('EDGE') ? 1 : 0
      ro['DrawProfiles']    = item[:style].include?('PROFILE')

      r = view.camera.aspect_ratio
      r = 1.0 if r.nil? || r == 0.0
      w, h = r >= 1.0 ? [@export_job.max_res, (@export_job.max_res / r).to_i] : [(@export_job.max_res * r).to_i, @export_job.max_res]

      filepath = File.join(@export_job.export_dir, item[:style], "#{item[:name]}.png")
      @export_job.record_success if view.write_image(filepath, w, h, @export_job.aa)
    end

    update_progress(@export_job.progress_pct)
    Sketchup.set_status_text("Exporting Image #{@export_job.current} of #{@export_job.total}...")
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





