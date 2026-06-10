# frozen_string_literal: true

module ApayaStudioPro
  module UiGateway
    # All execute_script calls go through here — single tracepoint
    def js_exec(script)
      @dialog&.execute_script(script)
    end

    def js_modal(title, msg, icon, color)
      js_exec("showApayaModal(#{title.to_json}, #{msg.to_json}, #{icon.to_json}, #{color.to_json});")
    end

    # Convenience modal wrappers
    def show_error(title, msg)
      js_modal(title, msg, 'fa-xmark', 'var(--danger)')
    end

    def show_success(title, msg)
      js_modal(title, msg, 'fa-circle-check', 'var(--primary)')
    end

    def show_warning(title, msg)
      js_modal(title, msg, 'fa-triangle-exclamation', 'var(--orange)')
    end

    # Named bridge methods — one point per JS function
    def trigger_init_data
      js_exec('sketchup.get_init_data();')
    end

    def set_ratio_display(ratio_pt, ratio_ls)
      js_exec("document.getElementById('inp-pt').value = #{ratio_pt}; document.getElementById('inp-ls').value = #{ratio_ls};")
    end

    def set_init_license(key, credits)
      js_exec("setInitLicense(#{key.to_json}, #{credits});")
    end

    def apply_remote_config(config)
      js_exec("applyRemoteConfig(#{config.to_json});")
    end

    def update_credit_display(credits)
      js_exec("updateCreditDisplay(#{credits.to_json});")
    end

    def update_camera_list(cam_data)
      js_exec("updateCameraList(#{cam_data.to_json});")
    end

    def set_before_image(b64)
      js_exec("setBeforeImage(#{b64.to_json});")
    end

    def hide_render_overlays
      js_exec("document.getElementById('r-loading-overlay').style.display='none'; document.getElementById('ai-loading-overlay').style.display='none';")
    end

    def hide_mat_overlay
      js_exec("document.getElementById('mat-loading-overlay').style.display='none';")
    end

    def hide_upscale_overlay
      js_exec("document.getElementById('upscale-loading-overlay').style.display='none';")
    end

    def on_motion_swap_failed(msg)
      js_exec("onMotionSwapFailed(#{msg.to_json});")
    end

    def export_complete(count, dir)
      js_exec("exportComplete(#{count}, #{dir.to_json});")
    end

    def update_progress(pct)
      js_exec("updateProgress(#{pct});")
    end
  end
end
