# frozen_string_literal: true

require_relative 'supabase_client'

module ApayaStudioPro
  module AiClient
    extend self

    def request_render(license_key, full_prompt, public_url_a, public_url_b, task_type, style: nil, denoise: nil, mask_url: nil)
      puts "[🚀 SUPABASE] Ngirim pesanan #{task_type} ke Edge Function..."
      payload = {
        license_key: license_key,
        prompt:      full_prompt,
        image_url:   public_url_a,
        ref_url:     public_url_b,
        mask_url:    mask_url,
        task_type:   task_type,
        style:       style,
        strength:    denoise
      }.compact
      res = SupabaseClient.post_json('/functions/v1/apaya-generate', payload)
      unless res && [200, 201].include?(res.code.to_i)
        puts "[❌ EDGE FUNCTION] HTTP #{res&.code} — #{SupabaseClient.safe_body(res).to_s[0..300]}"
        return 'ERROR'
      end
      data = JSON.parse(SupabaseClient.safe_body(res)) rescue nil
      unless data&.dig('jobId')
        puts "[❌ EDGE FUNCTION] No jobId in response — #{SupabaseClient.safe_body(res).to_s[0..300]}"
        return 'ERROR'
      end
      puts "[✅ EDGE FUNCTION] Queue Job ID: #{data['jobId']}"
      data['jobId'].to_s
    rescue => e
      puts "[❌ HTTP ERROR] #{e.message}"
      'ERROR'
    end
  end
end
