# frozen_string_literal: true

require 'fileutils'
require 'base64'
require 'net/http'
require 'uri'

# Handles saving AI result ke file lokal.
# Diperlukan karena SketchUp execute_script() crash kalau string > ~2000 karakter.
# Solusi: simpan base64/mp4 ke cache dir, pass file:// URL ke JS.
module ResultCache
  CACHE_DIR = File.join(File.expand_path('..', __dir__), 'Apaya_Gallery', 'cache').freeze

  def self.save_if_needed(image_url, task_type)
    if image_url.length > 2000
      save_base64(image_url, task_type)
    elsif task_type == 'motion' && image_url.start_with?('http')
      download_mp4(image_url)
    else
      image_url
    end
  end

  def self.save_base64(image_url, task_type)
    FileUtils.mkdir_p(CACHE_DIR)
    base64_data = image_url.sub(/\Adata:image\/[a-z]+;base64,/, '')
    timestamp   = Time.now.strftime('%Y%m%d_%H%M%S')
    path        = File.join(CACHE_DIR, "#{task_type}_#{timestamp}.png")
    File.binwrite(path, Base64.decode64(base64_data))
    file_uri(path)
  rescue => e
    puts "[CACHE ERROR] Gagal save base64 lokal: #{e.message}"
    nil
  end

  def self.download_mp4(url)
    FileUtils.mkdir_p(CACHE_DIR)
    timestamp = Time.now.strftime('%Y%m%d_%H%M%S')
    path      = File.join(CACHE_DIR, "motion_#{timestamp}.mp4")
    uri       = URI(url)
    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') do |http|
      File.binwrite(path, http.get(uri.request_uri).body)
    end
    file_uri(path)
  rescue => e
    puts "[DOWNLOAD ERROR] Gagal download mp4: #{e.message}"
    nil
  end

  def self.file_uri(path)
    'file:///' + path.gsub('\\', '/') + "?t=#{Time.now.to_i}"
  end
end
