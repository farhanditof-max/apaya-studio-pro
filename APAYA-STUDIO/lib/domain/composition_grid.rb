# frozen_string_literal: true

module ApayaStudioPro
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

  def self.toggle_grid
    if @current_grid_tool; @current_grid_tool.cycle_mode; else; Sketchup.active_model.select_tool(CompositionGridTool.new); end
  end
end
