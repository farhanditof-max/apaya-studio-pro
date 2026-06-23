# frozen_string_literal: true

require 'json'
require_relative 'image_url_extractor'
require_relative 'result_cache'

module ApayaStudioPro
  class PollingManager
    MAX_ATTEMPTS   = 120
    POLL_INTERVAL  = 3

    SUCCESS_STATUSES = %w[success completed done sukses].freeze
    FAILED_STATUSES  = %w[failed error].freeze

    # Single source of truth: task_type → overlay DOM ID + JS callback.
    # Tasks tidak terdaftar di sini fallback ke showAIResult(url, type).
    # Tambah task type baru = tambah 1 entry di sini saja.
    TASK_CONFIG = {
      'alchemist'  => { overlay: 'ai-loading-overlay',      js_fn: 'showAlchemistResult' },
      'motion'     => { overlay: 'motion-loading-overlay',  js_fn: 'onMotionSuccess'     },
      'magic_swap' => { overlay: 'swap-loading-overlay',    js_fn: 'onSwapSuccess'       },
      'upscale'    => { overlay: 'upscale-loading-overlay', js_fn: 'showUpscaleResult'   },
    }.freeze

    ALL_OVERLAYS = (TASK_CONFIG.values.map { |c| c[:overlay] } + %w[
      r-loading-overlay
      ai-loading-overlay
      mat-loading-overlay
    ]).uniq.freeze

    def initialize(task_id, task_type, gateway)
      @task_id   = task_id.to_s.strip
      @task_type = task_type
      @gateway   = gateway
      @attempts  = 0
      @active    = true
    end

    # Entry point — panggil sekali, manager handle sisanya secara async
    def start
      fetch_status
    end

    def stop
      @active = false
    end

    private

    def schedule_next
      return unless @active
      UI.start_timer(POLL_INTERVAL, false) { fetch_status if @active }
    end

    def fetch_status
      if @attempts >= MAX_ATTEMPTS
        return notify_timeout
      end
      @attempts += 1

      url = "#{ApayaConfig.supabase_url}/rest/v1/ai_render_jobs?id=eq.#{@task_id}&select=*"
      req = Sketchup::Http::Request.new(url, Sketchup::Http::GET)
      req.headers['apikey']        = ApayaConfig.supabase_key
      req.headers['Authorization'] = "Bearer #{ApayaConfig.supabase_key}"
      req.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
      req.headers['Pragma']        = 'no-cache'
      req.headers['Expires']       = '0'
      req.start { |_, res| handle_response(res) }
    end

    def handle_response(res)
      unless [200, 201].include?(res.status_code)
        puts "[POLLING HTTP ERROR] status: #{res.status_code}"
        return schedule_next
      end

      data = JSON.parse(res.body) rescue []
      puts "[POLLING] #{@attempts}/#{MAX_ATTEMPTS} | rows=#{data.length} | task=#{@task_type}"

      success = data.find { |r| SUCCESS_STATUSES.include?(r['status'].to_s.downcase.strip) }
      failed  = data.find { |r| FAILED_STATUSES.include?(r['status'].to_s.downcase.strip) }

      if success
        handle_success(success)
      elsif failed
        handle_failure
      else
        schedule_next
      end
    rescue => e
      puts "[POLLING ERROR] #{e.message}"
      schedule_next
    end

    def handle_success(row)
      @active = false
      raw = row['result_b64'] || row['result_url'] || row['image_url'] || row['result']
      url = ImageUrlExtractor.extract(raw)
      url = ResultCache.save_if_needed(url, @task_type)
      unless url
        puts "[CACHE ERROR] #{@task_type}: gagal simpan hasil, tidak bisa deliver"
        hide_overlays
        @gateway.show_error('Gagal Simpan Hasil', 'Disk mungkin penuh. Coba kosongkan ruang penyimpanan.')
        return
      end
      puts "[SUKSES] #{@task_type} selesai: #{url[0..40]}..."
      deliver_result(url)
    end

    def handle_failure
      @active = false
      puts "[GAGAL] Server AI: FAILED status"
      hide_overlays
      @gateway.show_error('Proses Gagal', 'Server AI menolak memproses gambar.')
    end

    def notify_timeout
      @active = false
      puts "[TIMEOUT] 6 menit habis untuk task #{@task_type}"
      hide_overlays
      @gateway.show_warning('Timeout', 'Waktu tunggu habis. Server AI mungkin sedang sangat sibuk memproses antrean.')
    end

    def hide_overlays
      js = ALL_OVERLAYS.map { |id| "document.getElementById('#{id}').style.display='none';" }.join(' ')
      @gateway.js_exec(js)
    end

    def deliver_result(url)
      safe_url = url.to_json
      config   = TASK_CONFIG[@task_type]
      js = if config
             "#{config[:js_fn]}(#{safe_url});"
           else
             "showAIResult(#{safe_url}, #{@task_type.to_json});"
           end
      @gateway.js_exec(js)
    end
  end

  # Batch-specific poller: success/failure routed to BatchRenderManager via blocks.
  class BatchPollingManager < PollingManager
    def initialize(task_id, task_type, gateway, cam_name, on_success, on_failure)
      super(task_id, task_type, gateway)
      @cam_name   = cam_name
      @on_success = on_success
      @on_failure = on_failure
    end

    private

    def deliver_result(url)
      @on_success.call(url)
    end

    def handle_failure
      @active = false
      puts "[BATCH FAIL] #{@cam_name}"
      hide_overlays
      @on_failure.call
    end

    def notify_timeout
      @active = false
      puts "[BATCH TIMEOUT] #{@cam_name}"
      hide_overlays
      @on_failure.call
    end
  end
end
