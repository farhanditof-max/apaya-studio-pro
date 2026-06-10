# frozen_string_literal: true

require 'json'

# Pure module — tidak ada SketchUp dependency, bisa di-test langsung.
# Unwrap image URL dari berbagai format response AI API:
# String JSON, Hash nested, Array, atau plain URL/base64.
module ImageUrlExtractor
  def self.extract(raw)
    url = raw

    # Unwrap kalau string berisi JSON
    if url.is_a?(String) && url.match?(/\A[\[{]/)
      url = JSON.parse(url) rescue url
    end

    # Unwrap Hash — coba key yang umum dipakai AI API
    if url.is_a?(Hash)
      url = url['images'] || url['image'] || url['url'] || url['image_url'] || url.values.first
    end

    # Unwrap Array — ambil elemen pertama
    url = url[0] if url.is_a?(Array)

    # Unwrap Hash sekali lagi (nested response)
    if url.is_a?(Hash)
      url = url['url'] || url['image'] || url.values.first
    end

    url.to_s.strip
  end
end
