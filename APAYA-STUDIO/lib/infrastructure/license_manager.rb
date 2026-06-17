# frozen_string_literal: true

require_relative 'supabase_client'

module ApayaStudioPro
  module LicenseManager
    extend self

    def verify(key)
      res = SupabaseClient.post_json('/rest/v1/rpc/get_license_credits', { p_key: key.to_s })
      return nil unless res && [200, 201].include?(res.code.to_i)
      credits = JSON.parse(SupabaseClient.safe_body(res)) rescue nil
      credits&.to_i
    rescue => e
      puts "[❌ DB ERROR] Cek Lisensi Gagal: #{e.message}"
      nil
    end

    def save(key)
      Sketchup.write_default('ApayaAI', 'LicenseKey', key.to_s)
    end
  end
end
