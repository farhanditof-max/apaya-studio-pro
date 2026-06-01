const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let src = fs.readFileSync(TARGET, 'utf8');

const oldCode = `    if b64_data.to_s.start_with?("http")
      return b64_data
    elsif b64_data.to_s.start_with?("file:///")
      file_path = b64_data.to_s.sub("file:///", "").gsub("%20", " ")
      begin
        request["Content-Type"] = file_path.downcase.end_with?(".png") ? "image/png" : "image/jpeg"
        request.body = File.open(file_path, 'rb').read
      rescue => e
        puts "[ERROR] Gagal membaca file lokal: #{e.message}"
        return nil
      end
    else
      # Deteksi content-type dari header data URI (image/png vs image/jpeg)
      if b64_data.include?(",")
        mime_part = b64_data.split(",")[0]  # e.g. "data:image/png;base64"
        content_type = mime_part.include?("png") ? "image/png" : "image/jpeg"
        clean_b64 = b64_data.split(",")[1]
      else
        # Cek magic bytes PNG: base64 dari \\x89PNG dimulai dengan "iVBOR"
        content_type = b64_data.start_with?("iVBOR") ? "image/png" : "image/jpeg"
        clean_b64 = b64_data
      end
      request["Content-Type"] = content_type
      request.body = Base64.decode64(clean_b64)
    end`;

const newCode = `    content_type = "image/jpeg"
    clean_b64 = nil
    file_path = nil

    if b64_data.to_s.start_with?("http")
      return b64_data
    elsif b64_data.to_s.start_with?("file:///")
      file_path = b64_data.to_s.sub("file:///", "").gsub("%20", " ")
      content_type = file_path.downcase.end_with?(".png") ? "image/png" : "image/jpeg"
    else
      if b64_data.include?(",")
        mime_part = b64_data.split(",")[0]
        content_type = mime_part.include?("png") ? "image/png" : "image/jpeg"
        clean_b64 = b64_data.split(",")[1]
      else
        content_type = b64_data.start_with?("iVBOR") ? "image/png" : "image/jpeg"
        clean_b64 = b64_data
      end
    end

    # Sesuaikan ekstensi file berdasarkan content_type
    ext = content_type == "image/png" ? ".png" : ".jpg"
    file_name = file_name.sub(/\\.(jpg|jpeg|png)$/i, "") + ext

    safe_file_name = file_name.gsub(/[^0-9A-Za-z.\\-]/, '_')
    url = URI("#{@supabase_url}/storage/v1/object/apaya-temp/#{safe_file_name}")
    
    # recreate http request because url might have changed
    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    http.open_timeout = 30
    http.read_timeout = 60

    request = Net::HTTP::Post.new(url)
    request["apikey"] = @supabase_key
    request["Authorization"] = "Bearer #{@supabase_key}"
    request["Accept-Encoding"] = "identity"
    request["Content-Type"] = content_type

    if file_path
      begin
        request.body = File.open(file_path, 'rb').read
      rescue => e
        puts "[ERROR] Gagal membaca file lokal: #{e.message}"
        return nil
      end
    else
      request.body = Base64.decode64(clean_b64)
    end`;

// Since we are overriding how URL is built, we need to replace the whole block starting from `safe_file_name`
const startSearch = `  def self.upload_b64_to_supabase(b64_data, file_name)
    safe_file_name = file_name.gsub(/[^0-9A-Za-z.\\-]/, '_')
    url = URI("#{@supabase_url}/storage/v1/object/apaya-temp/#{safe_file_name}")`;

const replacement = `  def self.upload_b64_to_supabase(b64_data, file_name)
    content_type = "image/jpeg"
    clean_b64 = nil
    file_path = nil

    if b64_data.to_s.start_with?("http")
      return b64_data
    elsif b64_data.to_s.start_with?("file:///")
      file_path = b64_data.to_s.sub("file:///", "").gsub("%20", " ")
      content_type = file_path.downcase.end_with?(".png") ? "image/png" : "image/jpeg"
    else
      if b64_data.include?(",")
        mime_part = b64_data.split(",")[0]
        content_type = mime_part.include?("png") ? "image/png" : "image/jpeg"
        clean_b64 = b64_data.split(",")[1]
      else
        content_type = b64_data.start_with?("iVBOR") ? "image/png" : "image/jpeg"
        clean_b64 = b64_data
      end
    end

    ext = content_type == "image/png" ? ".png" : ".jpg"
    file_name = file_name.sub(/\\.(jpg|jpeg|png)$/i, "") + ext

    safe_file_name = file_name.gsub(/[^0-9A-Za-z.\\-]/, '_')
    url = URI("#{@supabase_url}/storage/v1/object/apaya-temp/#{safe_file_name}")`;

// We also need to remove the old URL logic
let srcLines = src.split('\\n');
let funcStart = srcLines.findIndex(l => l.includes('def self.upload_b64_to_supabase'));
let funcEnd = srcLines.findIndex((l, i) => i > funcStart && l.includes('end') && srcLines[i+1] && srcLines[i+1].includes('def '));
// This is too fragile. Let's just use string replace.
