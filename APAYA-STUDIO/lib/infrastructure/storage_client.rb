# frozen_string_literal: true

require 'base64'
require_relative 'supabase_client'
require_relative '../config'

module ApayaStudioPro
  module StorageClient
    extend self

    def upload_image(image_path, file_name)
      puts "[⬆ SUPABASE] Uploading Viewport SketchUp..."
      res = SupabaseClient.upload(
        "/storage/v1/object/apaya-temp/#{file_name}",
        File.binread(image_path),
        'image/png'
      )
      return nil unless res && [200, 201].include?(res.code.to_i)
      public_url = "#{ApayaConfig.supabase_url}/storage/v1/object/public/apaya-temp/#{file_name}"
      puts "[✅ SUPABASE] Viewport URL: #{public_url}"
      public_url
    rescue => e
      puts "[❌ UPLOAD GAGAL] #{e.message}"
      nil
    end

    def upload_b64(b64_data, file_name)
      return b64_data if b64_data.start_with?('http')
      clean_b64 = b64_data.include?(',') ? b64_data.split(',')[1] : b64_data
      puts "[⬆ SUPABASE] Uploading Base64 Data..."
      res = SupabaseClient.upload(
        "/storage/v1/object/apaya-temp/#{file_name}",
        Base64.decode64(clean_b64),
        'image/jpeg'
      )
      return nil unless res && [200, 201].include?(res.code.to_i)
      public_url = "#{ApayaConfig.supabase_url}/storage/v1/object/public/apaya-temp/#{file_name}"
      puts "[✅ SUPABASE] B64 URL: #{public_url}"
      public_url
    rescue => e
      puts "[❌ UPLOAD GAGAL] #{e.message}"
      nil
    end
  end
end
