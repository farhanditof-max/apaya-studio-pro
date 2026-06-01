require 'sketchup.rb'
require 'extensions.rb'

module ApayaStudioPro
  unless file_loaded?(__FILE__)
    ext = SketchupExtension.new("Apaya Studio Pro", "APAYA-STUDIO/main.rb")
    ext.description = "Apaya Studio Pro - AI Rendering & Material Alchemist Extension"
    ext.version = "1.0.0"
    ext.creator = "Apaya Studio"
    Sketchup.register_extension(ext, true)
    file_loaded(__FILE__)
  end
end
