# frozen_string_literal: true

module ApayaStudioPro
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
end
