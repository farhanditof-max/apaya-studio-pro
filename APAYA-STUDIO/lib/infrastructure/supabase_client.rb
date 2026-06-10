# frozen_string_literal: true

require 'net/http'
require 'uri'
require 'json'
require 'openssl'
require 'zlib'
require 'stringio'
require_relative '../config'

module SupabaseClient
  extend self

  def get(path)
    request(:get, path)
  end

  def post_json(path, body)
    request(:post, path, body: body.to_json, content_type: 'application/json')
  end

  def upload(path, binary_data, content_type)
    request(:post, path, body: binary_data, content_type: content_type)
  end

  def safe_body(res)
    return "" if res.nil? || res.body.nil?
    body = res.body
    is_gzip = false
    begin
      is_gzip = (body.length >= 2 && body.getbyte(0) == 0x1F && body.getbyte(1) == 0x8B)
    rescue
    end
    if is_gzip
      begin
        sio = StringIO.new(body)
        gz  = Zlib::GzipReader.new(sio)
        body = gz.read
        gz.close
      rescue => e
        puts "[GZIP ERROR] Failed to decompress: #{e.message}"
      end
    end
    body.to_s.encode('UTF-8', invalid: :replace, undef: :replace, replace: '?')
  end

  private

  def request(method, path, opts = {})
    uri  = URI("#{ApayaStudioPro::ApayaConfig.supabase_url}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl     = true
    http.verify_mode = OpenSSL::SSL::VERIFY_NONE
    req = build_request(method, uri, opts)
    http.request(req)
  rescue => e
    puts "[SUPABASE HTTP ERROR] #{e.message}"
    nil
  end

  def build_request(method, uri, opts)
    req = (method == :get ? Net::HTTP::Get : Net::HTTP::Post).new(uri)
    req['apikey']          = ApayaStudioPro::ApayaConfig.supabase_key
    req['Authorization']   = "Bearer #{ApayaStudioPro::ApayaConfig.supabase_key}"
    req['Accept-Encoding'] = 'identity'
    req['Content-Type']    = opts[:content_type] if opts[:content_type]
    req.body               = opts[:body]          if opts[:body]
    req
  end
end
