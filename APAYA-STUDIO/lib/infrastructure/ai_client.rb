# frozen_string_literal: true

require_relative 'supabase_client'

module ApayaStudioPro
  module AiClient
    extend self

    def request_render(license_key, full_prompt, public_url_a, public_url_b, task_type, style: nil, denoise: nil, mask_url: nil)
      puts "[🚀 SUPABASE] Ngirim pesanan #{task_type} ke Edge Function..."
      res = SupabaseClient.post_json('/functions/v1/apaya-generate', {
        license_key: license_key,
        prompt:      full_prompt,
        image_url:   public_url_a,
        ref_url:     public_url_b,
        mask_url:    mask_url,
        task_type:   task_type,
        style:       style,
        strength:    denoise
      })
      return 'ERROR' unless res && [200, 201].include?(res.code.to_i)
      data = JSON.parse(SupabaseClient.safe_body(res)) rescue nil
      return 'ERROR' unless data&.dig('taskId')
      puts "[✅ EDGE FUNCTION] Task ID: #{data['taskId']}"
      data['taskId']
    rescue => e
      puts "[❌ HTTP ERROR] #{e.message}"
      'ERROR'
    end
  end
end
