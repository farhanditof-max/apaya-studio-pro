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
      # Hasil base64 inline (kadang dipakai sebagian task) → tulis ke .png
      save_base64(image_url, task_type)
    elsif image_url.start_with?('http')
      # Hasil dari Kie.ai berupa URL remote. Download ke lokal supaya:
      # 1. Tetap ada walau URL Kie.ai expire beberapa hari kemudian
      # 2. Bisa dipakai ulang untuk swap / motion downstream
      ext = task_type == 'motion' ? 'mp4' : 'png'
      download_remote(image_url, task_type, ext)
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

  def self.download_remote(url, task_type, ext)
    FileUtils.mkdir_p(CACHE_DIR)
    timestamp = Time.now.strftime('%Y%m%d_%H%M%S')
    path      = File.join(CACHE_DIR, "#{task_type}_#{timestamp}.#{ext}")
    uri       = URI(url)
    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https',
                    verify_mode: OpenSSL::SSL::VERIFY_NONE) do |http|
      File.binwrite(path, http.get(uri.request_uri).body)
    end
    file_uri(path)
  rescue => e
    puts "[DOWNLOAD ERROR] Gagal download #{ext}: #{e.message}"
    nil
  end

  def self.file_uri(path)
    # Normalize to forward slashes (Windows backslash → forward slash)
    normalized = path.gsub('\\', '/')
    # Mac path starts with '/', Windows with drive letter — build URI accordingly
    normalized.start_with?('/') ? "file://#{normalized}?t=#{Time.now.to_i}"
                                : "file:///#{normalized}?t=#{Time.now.to_i}"
  end
end
