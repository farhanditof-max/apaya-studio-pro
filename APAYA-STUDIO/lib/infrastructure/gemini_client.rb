# frozen_string_literal: true

require 'net/http'
require 'openssl'
require 'json'
require 'uri'

module ApayaStudioPro
  module GeminiClient
    extend self

    def analyze(image_base64:, room_name:, master_prompt_template:)
      uri = URI("#{ApayaConfig.supabase_url}/functions/v1/apaya-vision-analyze")

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl     = true
      http.verify_mode = OpenSSL::SSL::VERIFY_NONE
      http.read_timeout = 60

      request = Net::HTTP::Post.new(uri)
      request['Content-Type'] = 'application/json'
      request['Authorization'] = "Bearer #{ApayaConfig.supabase_key}"
      request.body = JSON.generate(
        image_base64: image_base64,
        room_name: room_name,
        master_prompt_template: master_prompt_template
      )

      response = http.request(request)

      if response.code.to_i == 200
        JSON.parse(response.body)
      else
        puts "[GeminiClient] Error: #{response.code} — #{response.body[0..200]}"
        nil
      end
    rescue => e
      puts "[GeminiClient] Exception: #{e.message}"
      nil
    end
  end
end
