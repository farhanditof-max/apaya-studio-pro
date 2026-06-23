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
require_relative 'lib/infrastructure/gemini_client'
require_relative 'lib/domain/batch_render_manager'
require_relative 'lib/domain/scene_data'
require_relative 'lib/domain/composition_grid'
require_relative 'lib/domain/camera'
require_relative 'lib/domain/export_job'
require_relative 'lib/interface/ui_gateway'
require_relative 'lib/interface/camera_dialog'


module ApayaStudioPro
  extend self
  extend UiGateway

  @current_grid_tool = nil
  CURRENT_VERSION = "1.0.0" 
  
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
    d.add_action_callback('save_to_gallery')              { |_, v| on_save_to_gallery(v) }
    d.add_action_callback('apply_license')                { |_, k| on_apply_license(k) }
    d.add_action_callback('analyze_scene_with_gemini')    { |_, p| on_analyze_scene_with_gemini(p) }
    d.add_action_callback('start_batch_render')           { |_, p| on_start_batch_render(p) }
    d.add_action_callback('append_batch_queue')           { |_, p| on_append_batch_queue(p) }
    d.add_action_callback('cancel_batch_item')            { |_, p| on_cancel_batch_item(p) }
  end

  # Sanitize cam_name for use in HTTP URIs (Supabase storage path).
  # Spaces and special chars cause URI::InvalidURIError.
  def safe_storage_name(name)
    name.to_s.gsub(/[^A-Za-z0-9_.-]/, '_')
  end

  def load_saved_license
    Sketchup.read_default('ApayaAI', 'LicenseKey', '')
  end

  def load_cached_credits
    Sketchup.read_default('ApayaAI', 'CachedCredits', 0).to_i
  end

  def save_cached_credits(credits)
    Sketchup.write_default('ApayaAI', 'CachedCredits', credits.to_i)
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

    # Render UI immediately with cached data — zero network wait
    cached_credits = saved_key.empty? ? 0 : load_cached_credits
    set_ratio_display(@ratio_pt, @ratio_ls)
    set_init_license(saved_key, cached_credits)
    send_camera_list

    # Defer HTTP calls by 100ms — lets dialog paint first, stays on main thread
    UI.start_timer(0.1, false) do
      begin
        credits = (saved_key.empty? ? 0 : LicenseManager.verify(saved_key)) || 0
        save_cached_credits(credits)
        set_init_license(saved_key, credits)

        config = RemoteConfig.fetch
        puts "[REMOTE CONFIG] show_claim=#{config['show_claim_button']} | enable_ai=#{config['enable_ai_features']}"
        apply_remote_config(config)
      rescue => e
        puts "[ERROR] on_get_init_data deferred: #{e.message}"
      end
    end
  end

  def on_update_stored_ratios(data)
    @ratio_pt = data[0].to_f
    @ratio_ls = data[1].to_f
    Sketchup.write_default('ApayaAI', 'RatioPortrait', @ratio_pt)
    Sketchup.write_default('ApayaAI', 'RatioLandscape', @ratio_ls)
  end

  def on_apply_license(key)
    return unless key.is_a?(String)
    return unless key.match?(/\AAPAYA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\z/)
    LicenseManager.save(key)
    on_get_init_data
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
    w = ratio >= 1.0 ? 1280 : (720 * ratio).to_i
    h = ratio >= 1.0 ? (1280 / ratio).to_i : 720
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
        safe_cam = safe_storage_name(cam_name)
        public_url_a = StorageClient.upload_image(temp_img_path, "skp_#{safe_cam}_#{Time.now.to_i}.png")
        public_url_b = nil
        if mat_board_b64 && !mat_board_b64.empty?
          public_url_b = StorageClient.upload_b64(mat_board_b64, "mat_#{safe_cam}_#{Time.now.to_i}.jpg")
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


  # ==========================================
  # AI PROMPT (GEMINI VISION) + BATCH RENDER
  # ==========================================

  def on_analyze_scene_with_gemini(params)
    cam_name  = params[0]
    room_name = params[1]

    img_path = File.join(__dir__, 'temp', "before_#{cam_name}.png")
    unless File.exist?(img_path)
      js_exec("showToast('Error', 'Gambar kamera belum tersedia. Klik kamera dulu.')")
      js_exec("window.onGeminiAnalysisComplete('#{cam_name}', 'failed')")
      return
    end

    master_prompt_path = File.join(__dir__, '05_Master_Prompt.md')
    unless File.exist?(master_prompt_path)
      js_exec("window.onGeminiAnalysisComplete('#{cam_name}', 'failed')")
      puts "[GeminiAnalysis] 05_Master_Prompt.md tidak ditemukan"
      return
    end

    UI.start_timer(0.1, false) do
      begin
        img_base64             = Base64.strict_encode64(File.binread(img_path))
        master_prompt_template = File.read(master_prompt_path, encoding: 'utf-8')

        response = GeminiClient.analyze(
          image_base64:           img_base64,
          room_name:              room_name,
          master_prompt_template: master_prompt_template
        )

        if response && response['injected_prompt']
          @gemini_prompts ||= {}
          @gemini_prompts[cam_name] = response['injected_prompt']
          js_exec("window.onGeminiAnalysisComplete(#{cam_name.to_json}, 'success')")
        else
          js_exec("window.onGeminiAnalysisComplete(#{cam_name.to_json}, 'failed')")
        end
      rescue => e
        puts "[GeminiAnalysis] #{e.message}"
        js_exec("window.onGeminiAnalysisComplete(#{cam_name.to_json}, 'failed')")
      end
    end
  end

  def on_start_batch_render(params)
    begin
      raw   = params.is_a?(Array) ? params[0] : params
      data  = JSON.parse(raw)
      puts "[BATCH] start_batch_render: #{data['cameras']&.length} cams, mode=#{data['prompt_mode']}, res=#{data['resolution']}"

      cam_names     = data['cameras']
      room_name     = data['room_name']
      prompt_mode   = data['prompt_mode']
      manual_prompt = data['manual_prompt']
      style         = data['style']
      resolution    = data['resolution']
      env           = data['env']
      waktu         = data['waktu']

      unless cam_names.is_a?(Array) && cam_names.length > 0
        puts "[BATCH] cam_names kosong atau bukan Array, abort"
        return
      end

      credit_per = resolution == '4k' ? 2 : 1
      total_cost = cam_names.length * credit_per

      result = check_license(total_cost)
      return unless result
      key, credits = result
      update_credit_display(credits - total_cost)

      @batch_manager = BatchRenderManager.new
      @batch_manager.on_status_change do |cam, status, url, before_url|
        safe_url    = url        ? url.to_json        : 'undefined'
        safe_before = before_url ? before_url.to_json : 'undefined'
        js_exec("updateBatchStatus(#{cam.to_json}, '#{status}', #{safe_url}, #{safe_before})")
      end
      @batch_manager.on_complete do |stats|
        js_exec("onBatchComplete(#{stats[:done]}, #{stats[:failed]})")
        on_get_init_data
      end

      jobs = cam_names.map do |cam|
        auto_fallback = JSON.generate({ manual_prompt: '', waktu: waktu || 'siang', env: env || 'interior', lampu: false, kendaraan: '', vegetasi: '' })
        prompt = case prompt_mode
                 when 'ai'
                   gemini_p = @gemini_prompts&.dig(cam).to_s
                   gemini_p.empty? ? auto_fallback : gemini_p
                 else
                   manual_prompt.to_s.empty? ? auto_fallback : manual_prompt
                 end
        puts "[BATCH] #{cam}: mode=#{prompt_mode} prompt_len=#{prompt.to_s.length}"
        { cam_name: cam, room_name: room_name, prompt: prompt,
          style: style, resolution: resolution, env: env,
          waktu: waktu, credit_cost: credit_per, license_key: key }
      end
      @batch_manager.add_jobs(jobs)
      process_batch_queue
    rescue => e
      puts "[BATCH ERROR] on_start_batch_render: #{e.message}\n#{e.backtrace.first(3).join("\n")}"
      show_error('Batch Render Error', "Gagal memulai batch: #{e.message}")
    end
  end

  def process_batch_queue
    return unless @batch_manager
    @batch_manager.next_jobs.each do |job|
      @batch_manager.mark_processing(job[:cam_name])
      process_single_batch_job(job)
    end
  end

  def process_single_batch_job(job)
    cam_name = job[:cam_name]
    UI.start_timer(0.2, false) do
      begin
        # Switch scene + capture viewport
        page = Sketchup.active_model.pages[cam_name]
        unless page
          @batch_manager.mark_failed(cam_name)
          process_batch_queue
          next
        end
        model = Sketchup.active_model
        prev_trans = model.options['PageOptions']['ShowTransition']
        model.options['PageOptions']['ShowTransition'] = false
        model.pages.selected_page = page
        ratio = (page.get_attribute('ApayaAI', 'aspect_ratio') || 1.0).to_f
        view  = model.active_view
        view.camera.aspect_ratio = ratio
        w = ratio >= 1.0 ? 1280 : (720 * ratio).to_i
        h = ratio >= 1.0 ? (1280 / ratio).to_i : 720
        temp_dir = File.join(__dir__, 'temp')
        FileUtils.mkdir_p(temp_dir)
        img_path = File.join(temp_dir, "before_#{cam_name}.png")
        write_ok = view.write_image(img_path, w, h, true)
        model.options['PageOptions']['ShowTransition'] = prev_trans
        file_size = File.exist?(img_path) ? File.size(img_path) : 0
        puts "[BATCH] write_image=#{write_ok} | file=#{img_path} | size=#{file_size}b"

        if file_size < 1000
          puts "[BATCH FAIL] File terlalu kecil (#{file_size}b) — write_image mungkin gagal"
          @batch_manager.mark_failed(cam_name)
          process_batch_queue
          next
        end

        public_url = StorageClient.upload_image(img_path, "batch/#{safe_storage_name(cam_name)}_#{Time.now.to_i}.png")
        puts "[BATCH] upload result: #{public_url ? 'OK → ' + public_url[0..60] : 'FAILED (nil)'}"
        unless public_url
          @batch_manager.mark_failed(cam_name)
          process_batch_queue
          next
        end

        task_type = job[:resolution] == '4k' ? 'render_4k' : 'render'
        puts "[BATCH] sending to AI: task_type=#{task_type} style=#{job[:style]} prompt_len=#{job[:prompt].to_s.length}"
        task_id = AiClient.request_render(job[:license_key], job[:prompt], public_url, nil, task_type, style: job[:style])
        puts "[BATCH] task_id=#{task_id}"

        if task_id == 'ERROR'
          @batch_manager.mark_failed(cam_name)
          process_batch_queue
          next
        end

        before_img_url = public_url
        poller = BatchPollingManager.new(
          task_id, task_type, self, cam_name,
          ->(url) {
            @batch_manager.mark_done(cam_name, url, before_img_url)
            process_batch_queue
          },
          -> {
            @batch_manager.mark_failed(cam_name)
            process_batch_queue
          }
        )
        UI.start_timer(3, false) { poller.start }
      rescue => e
        puts "[BATCH ERROR] #{cam_name}: #{e.message}"
        @batch_manager&.mark_failed(cam_name)
        process_batch_queue
      end
    end
  end

  def on_append_batch_queue(params)
    return unless @batch_manager
    data        = JSON.parse(params.is_a?(Array) ? params[0] : params)
    cam_names   = data['cameras']
    prompt_mode = data['prompt_mode']
    manual_prompt = data['manual_prompt']

    key = load_saved_license
    return if key.empty?

    credit_per = data['resolution'] == '4k' ? 2 : 1
    jobs = cam_names.map do |cam|
      prompt = case prompt_mode
               when 'ai'     then @gemini_prompts&.dig(cam) || ''
               when 'manual' then manual_prompt
               else ''
               end
      { cam_name: cam, room_name: data['room_name'], prompt: prompt,
        style: data['style'], resolution: data['resolution'], env: data['env'],
        waktu: data['waktu'], credit_cost: credit_per, license_key: key }
    end
    @batch_manager.add_jobs(jobs)
    js_exec("appendBatchQueueItems(#{cam_names.to_json})")
    process_batch_queue
  end

  def on_cancel_batch_item(params)
    cam_name = params.is_a?(Array) ? params[0] : params
    @batch_manager&.cancel_queued(cam_name)
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





