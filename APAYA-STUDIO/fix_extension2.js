const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let src = fs.readFileSync(TARGET, 'utf8');

const regex = /def self\.upload_b64_to_supabase\(b64_data,\s*file_name\)[\s\S]*?(?=def self\.)/;
const match = src.match(regex);

if(match) {
    const newFunc = `def self.upload_b64_to_supabase(b64_data, file_name)
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
    url = URI("#{@supabase_url}/storage/v1/object/apaya-temp/#{safe_file_name}")
    
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
    end

    begin
      puts "[\u{23EB} SUPABASE] Uploading #{file_name} (#{content_type})..."
      response = http.request(request)
      body_res = self.safe_body(response)

      if [200, 201].include?(response.code.to_i)
        public_url = "#{@supabase_url}/storage/v1/object/public/apaya-temp/#{safe_file_name}"
        puts "[\u{2705} SUPABASE] Upload Sukses URL: #{public_url}"
        return public_url
      else
        puts "[\u{274C} SUPABASE ERROR] Code: #{response.code} | Body: #{body_res[0..200]}"
        return nil
      end
    rescue => e
      puts "[\u{274C} SUPABASE EXCEPTION] #{e.message}"
      return nil
    end
  end

  `;

    src = src.replace(regex, newFunc);
    fs.writeFileSync(TARGET, src, 'utf8');
    console.log("upload_b64_to_supabase updated completely.");
} else {
    console.log("Could not match the function.");
}
