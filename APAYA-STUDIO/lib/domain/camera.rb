# frozen_string_literal: true

module ApayaStudioPro
  module CameraControl
    extend self

    def update_fov(val)
      cam = Sketchup.active_model.active_view.camera
      cam.fov = val.to_f
    end

    def reset_rotation
      view = Sketchup.active_model.active_view
      cam  = view.camera
      eye  = cam.eye; target = cam.target
      horiz_target = Geom::Point3d.new(target.x, target.y, eye.z)
      cam.set(eye, horiz_target, [0, 0, 1])
      cam.perspective = true
      view.camera = cam
      view.invalidate
    end

    def update_clipping(val)
      model = Sketchup.active_model
      cam   = model.active_view.camera
      model.start_operation("Clip", true)
      model.rendering_options['DisplaySectionCuts']   = true
      model.rendering_options['DisplaySectionPlanes'] = false
      sp = model.active_entities.grep(Sketchup::SectionPlane).find { |s| s.name == "APAYA_CLIP" }
      if val.to_f <= 0
        model.active_entities.erase_entities(sp) if sp
      else
        model.active_entities.erase_entities(sp) if sp
        cut_p  = cam.eye.offset(cam.direction, val.to_f.cm)
        new_sp = model.active_entities.add_section_plane([cut_p, cam.direction])
        new_sp.name = "APAYA_CLIP"
        new_sp.activate
      end
      model.commit_operation
      model.active_view.invalidate
    end
  end
end
