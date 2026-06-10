# frozen_string_literal: true

module ApayaStudioPro
  class ExportJob
    RESOLUTIONS = { '8K' => 7680, '5K' => 5000, '4K' => 3840 }.freeze

    attr_reader :export_dir, :total, :success_count, :current, :max_res, :aa

    def initialize(scene_names, export_dir, styles, res, aa)
      @export_dir    = export_dir.tr('\\', '/')
      @aa            = aa
      @max_res       = RESOLUTIONS.fetch(res, 1920)
      @queue         = scene_names.flat_map { |n| styles.map { |s| { name: n, style: s } } }
      @total         = @queue.length
      @current       = 0
      @success_count = 0
    end

    def done?
      @queue.empty?
    end

    def progress_pct
      @total.zero? ? 100 : ((@current.to_f / @total) * 100).to_i
    end

    def shift_item
      @current += 1
      @queue.shift
    end

    def record_success
      @success_count += 1
    end
  end
end
