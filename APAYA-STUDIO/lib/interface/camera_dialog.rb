# frozen_string_literal: true

module ApayaStudioPro
  @cam_dialog = nil

  def self.show_camera_control
    if @cam_dialog && @cam_dialog.visible?
      @cam_dialog.bring_to_front
      return
    end
    @cam_dialog = UI::HtmlDialog.new(
      dialog_title:    "Camera Control",
      preferences_key: "ApayaCamCtrl",
      width: 280, height: 280,
      resizable: false,
      style: UI::HtmlDialog::STYLE_UTILITY
    )
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
    @cam_dialog.add_action_callback("update_fov")     { |_, v| CameraControl.update_fov(v) }
    @cam_dialog.add_action_callback("update_clip")    { |_, v| CameraControl.update_clipping(v) }
    @cam_dialog.add_action_callback("reset_rotation") { |_, _| CameraControl.reset_rotation }
    @cam_dialog.show
  end
end
