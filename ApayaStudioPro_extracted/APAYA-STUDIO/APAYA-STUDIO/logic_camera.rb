require 'sketchup.rb'
require 'fileutils'
require 'json'

module ApayaStudioPro
  extend self

  @current_grid_tool = nil

  # ==========================================
  # KELAS TOOL KOMPOSISI (APAYA YELLOW)
  # ==========================================
  class CompositionGridTool
    attr_accessor :grid_mode

    def initialize
      @grid_mode = 1
    end

    def activate
      ApayaStudioPro.instance_variable_set(:@current_grid_tool, self)
      update_status
    end

    def deactivate(view)
      ApayaStudioPro.instance_variable_set(:@current_grid_tool, nil)
      view.invalidate
    end

    def resume(view)
      update_status
      view.invalidate
    end

    def update_status
      msgs = ["", "Rule of Thirds", "Center Point"]
      Sketchup.set_status_text("Mode Grid: #{msgs[@grid_mode]} | Klik icon toolbar lagi untuk ganti | Pencet SPACE untuk keluar")
    end

    def cycle_mode
      @grid_mode += 1
      if @grid_mode > 2
        Sketchup.active_model.select_tool(nil)
        Sketchup.set_status_text("")
      else
        update_status
        Sketchup.active_model.active_view.invalidate
      end
    end

    def draw(view)
      return if @grid_mode == 0
      w = view.vpwidth
      h = view.vpheight
      view.drawing_color = Sketchup::Color.new(250, 204, 21, 200)
      view.line_width = 2
      view.line_stipple = ''

      case @grid_mode
      when 1 
        pts = [[w/3.0, 0], [w/3.0, h], [w*2.0/3.0, 0], [w*2.0/3.0, h],
               [0, h/3.0], [w, h/3.0], [0, h*2.0/3.0], [w, h*2.0/3.0]]
        view.draw2d(GL_LINES, pts)
      when 2 
        pts = [[w/2.0, h/2.0 - 30], [w/2.0, h/2.0 + 30],
               [w/2.0 - 30, h/2.0], [w/2.0 + 30, h/2.0]]
        view.draw2d(GL_LINES, pts)
      end
    end
  end

  def toggle_grid
    if @current_grid_tool
      @current_grid_tool.cycle_mode
    else
      Sketchup.active_model.select_tool(CompositionGridTool.new)
    end
  end

  # ==========================================
  # PRO CAMERA CONTROL (FOV & CLIP)
  # ==========================================
  def show_tilt_dialog
    if @tilt_dialog
      @tilt_dialog.bring_to_front
      return
    end

    current_fov = Sketchup.active_model.active_view.camera.fov.round(1)

    options = {
      dialog_title: "Apaya Pro Camera",
      preferences_key: "DitoAITiltSlider",
      scrollable: false, resizable: false,
      width: 380, height: 130, 
      style: UI::HtmlDialog::STYLE_DIALOG
    }

    @tilt_dialog = UI::HtmlDialog.new(options)
    
    html = <<-HTML
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { background: #161821; color: white; font-family: 'Segoe UI', sans-serif; padding: 15px; margin: 0; display: flex; flex-direction: column; gap: 15px; overflow: hidden;}
        .row { display: flex; align-items: center; justify-content: space-between; }
        .label { font-size: 11px; font-weight: bold; color: #8b8d9c; width: 75px; }
        input[type=range] { flex: 1; margin: 0 10px; cursor: pointer; accent-color: #FACC15; }
        .val-box { background: #0d0f14; border: 1px solid #FACC15; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #FACC15; width: 45px; text-align: center; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="row">
        <span class="label">Lens FOV</span>
        <input type="range" id="fov-slider" min="10" max="120" value="#{current_fov}" oninput="updateFov(this.value)">
        <div class="val-box" id="fov-val">#{current_fov}&deg;</div>
      </div>
      <div class="row">
        <span class="label" style="color:#4ade80;">Wall Clip</span>
        <input type="range" id="clip-slider" min="0" max="800" value="0" oninput="updateClip(this.value)">
        <div class="val-box" id="clip-val" style="border-color:#4ade80; color:#4ade80;">0</div>
      </div>
      <script>
        let t3, t4;
        function updateFov(v) { document.getElementById('fov-val').innerText = v + '°'; clearTimeout(t3); t3 = setTimeout(() => sketchup.update_fov(v), 20); }
        function updateClip(v) { document.getElementById('clip-val').innerText = v; clearTimeout(t4); t4 = setTimeout(() => sketchup.update_clipping(v), 30); }
      </script>
    </body>
    </html>
    HTML
    
    @tilt_dialog.set_html(html)
    @tilt_dialog.add_action_callback("update_fov") { |_, val| Sketchup.active_model.active_view.camera.fov = val.to_f }
    @tilt_dialog.add_action_callback("update_clipping") do |_, val|
      model = Sketchup.active_model
      cam = model.active_view.camera
      model.start_operation("Clip", true)
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
    end

    @tilt_dialog.set_on_closed { @tilt_dialog = nil }
    @tilt_dialog.show
  end

  # ==========================================
  # FUNGSI-FUNGSI MANAJEMEN KAMERA
  # ==========================================
  def send_camera_list
    return unless @dialog
    model = Sketchup.active_model
    cam_data = model.pages.map do |p|
      stored_ratio = p.get_attribute('ApayaAI', 'aspect_ratio')
      aspect_f = stored_ratio ? stored_ratio.to_f : 1.0
      
      type = aspect_f < 1.0 ? 'PORTRAIT' : 'LANDSCAPE'
      
      { 
        name: p.name.to_s, 
        type: type, 
        aspect: sprintf('%.2f', aspect_f)
      }
    end
    @dialog.execute_script("updateCameraList(#{cam_data.to_json});")
  end

  def create_camera(type, manual_ratio = nil)
    model = Sketchup.active_model
    view = model.active_view
    
    @ratio_pt ||= Sketchup.read_default("ApayaAI", "RatioPortrait", 0.8).to_f
    @ratio_ls ||= Sketchup.read_default("ApayaAI", "RatioLandscape", 1.43).to_f
    
    ratio = manual_ratio ? manual_ratio.to_f : (type == 'portrait' ? @ratio_pt : @ratio_ls)

    model.start_operation('Create Apaya Cam', true)
    view.camera.aspect_ratio = ratio
    view.camera.perspective = true
    Sketchup.send_action("viewTwoPointPerspective:")
    
    prefix = (type == 'portrait') ? 'APAYA_PT' : 'APAYA_LS'
    name = "#{prefix}_#{Time.now.strftime('%H%M%S')}"
    
    new_page = model.pages.add(name)
    new_page.set_attribute('ApayaAI', 'aspect_ratio', ratio)
    
    model.commit_operation
    send_camera_list
  end

  # ==========================================
  # LOGIKA EXPORT & BATCH RENDER
  # ==========================================
  def start_export_queue(scene_names, export_dir, styles_to_export, resolution, aa_enabled)
    @export_dir = export_dir.tr('\\', '/')
    styles_to_export.each { |s| FileUtils.mkdir_p(File.join(@export_dir, s)) }
    
    @model = Sketchup.active_model
    @view = @model.active_view
    @prev_trans = @model.options["PageOptions"]["ShowTransition"]
    @model.options["PageOptions"]["ShowTransition"] = false
    @ro = @model.rendering_options
    @prev_edges = @ro['EdgeDisplayMode']
    @prev_profiles = @ro['DrawProfiles']
    
    @aa_enabled = aa_enabled 
    
    @max_res = case resolution
              when '8K' then 7680
              when '5K' then 5000
              when '4K' then 3840
              else 1920 
              end

    @export_queue = []
    scene_names.each do |name|
      styles_to_export.each { |s| @export_queue << { name: name, style: s } }
    end

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
      
      safe_dir = @export_dir.gsub("'", "\\\\'")
      
      @dialog.execute_script("exportComplete(#{@success_count}, '#{safe_dir}');")
      return
    end

    item = @export_queue.shift
    name = item[:name]
    s = item[:style]
    @current_export += 1

    page = @model.pages[name]
    if page
      @model.pages.selected_page = page
      stored_ratio = page.get_attribute('ApayaAI', 'aspect_ratio')
      @view.camera.aspect_ratio = stored_ratio.to_f if stored_ratio
      
      @ro['EdgeDisplayMode'] = (s.include?('EDGE') ? 1 : 0)
      @ro['DrawProfiles'] = (s.include?('PROFILE') ? true : false)
      
      UI.refresh_inspectors
      
      r = @view.camera.aspect_ratio
      r = 1.0 if r == 0.0 || r.nil?
      w, h = r >= 1.0 ? [@max_res, (@max_res/r).to_i] : [(@max_res*r).to_i, @max_res]
      
      filepath = File.join(@export_dir, s, "#{name}.png")
      
      if @view.write_image(filepath, w, h, @aa_enabled)
        @success_count += 1
      end
    end

    pct = ((@current_export.to_f / @total_exports.to_f) * 100).to_i
    @dialog.execute_script("updateProgress(#{pct});")
    Sketchup.set_status_text("Apaya Studio | Exporting Image #{@current_export} of #{@total_exports}...")

    UI.start_timer(0.1, false) { process_export_action }
  end
end