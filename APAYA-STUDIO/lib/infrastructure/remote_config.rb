# frozen_string_literal: true

require_relative 'supabase_client'

module ApayaStudioPro
  module RemoteConfig
    extend self

    DEFAULT_WA_NUMBER = '+62 857-4245-3372'

    def fetch
      res = SupabaseClient.get('/rest/v1/app_settings?id=eq.1&select=*')
      if res && res.code.to_i == 200
        data = JSON.parse(SupabaseClient.safe_body(res)) rescue nil
        if data.is_a?(Array) && !data.empty?
          row        = data[0]
          show_claim = [true, 'true'].include?(row['show_claim_button'])
          enable_ai  = [true, 'true'].include?(row['enable_ai_features'])
          wa_number  = row['whatsapp_number'].to_s.strip
          wa_number  = DEFAULT_WA_NUMBER if wa_number.empty?
          puts "[CONFIG OK] show_claim=#{show_claim} | enable_ai=#{enable_ai}"
          return { 'show_claim_button' => show_claim, 'enable_ai_features' => enable_ai, 'whatsapp_number' => wa_number }
        end
      end
      defaults
    rescue => e
      puts "[CONFIG ERROR] #{e.message.encode('UTF-8', invalid: :replace, undef: :replace, replace: '?')}"
      defaults
    end

    def defaults
      { 'show_claim_button' => false, 'enable_ai_features' => false, 'whatsapp_number' => DEFAULT_WA_NUMBER }
    end
  end
end
