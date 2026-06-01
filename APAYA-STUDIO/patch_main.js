const fs = require('fs');
const targetFile = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let content = fs.readFileSync(targetFile, 'utf8');

const oldTop = `    # Tembak Supabase pakai API Async Bawaan SketchUp
    url = "#{@supabase_url}/rest/v1/ai_render_jobs?kie_job_id=eq.#{clean_task_id}&select=*"
    
    request = Sketchup::Http::Request.new(url, Sketchup::Http::GET)
    request.headers["apikey"] = @supabase_key
    request.headers["Authorization"] = "Bearer #{@supabase_key}"
    request.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    
    request.start do |req, res|
      begin
        if [200, 201].include?(res.status_code)
          body = res.body
          data = JSON.parse(body)`;

const newTop = `    # Tembak Supabase pakai API HTTP Asli Ruby (Anti-Crash)
    url_str = "#{@supabase_url}/rest/v1/ai_render_jobs?kie_job_id=eq.#{clean_task_id}&select=*"
    uri = URI(url_str)
    
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = 20

    request = Net::HTTP::Get.new(uri)
    request["apikey"] = @supabase_key
    request["Authorization"] = "Bearer #{@supabase_key}"
    request["Cache-Control"] = "no-cache, no-store, must-revalidate"
    
    begin
      res = http.request(request)
      if [200, 201].include?(res.code.to_i)
        body = self.safe_body(res)
        data = JSON.parse(body)`;

if (content.includes(oldTop)) {
    content = content.replace(oldTop, newTop);
    console.log("Replaced top block");
} else {
    console.log("Top block not found! Trying with flexible matching...");
    // maybe \r\n vs \n
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normalizedOld = oldTop.replace(/\r\n/g, '\n');
    if (normalizedContent.includes(normalizedOld)) {
        content = normalizedContent.replace(normalizedOld, newTop);
        console.log("Replaced top block (normalized)");
    } else {
        console.log("STILL NOT FOUND");
    }
}

// Now replace the end block
const oldEnd = `        else
          puts "[HTTP ERROR] Server mengembalikan status: #{res.status_code}"
          UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
        end
      rescue => e
        puts "[POLLING CRASH] Async Error: #{e.message}"
        UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
      end
    end
  end`;

const newEnd = `        else
          puts "[HTTP ERROR] Server mengembalikan status: #{res.code}"
          UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
        end
      rescue => e
        puts "[POLLING CRASH] Sync Error: #{e.message}"
        UI.start_timer(3, false) { poll_supabase_job(task_id, task_type, attempts + 1) }
      end
  end`;

if (content.includes(oldEnd)) {
    content = content.replace(oldEnd, newEnd);
    console.log("Replaced end block");
} else {
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normalizedOldEnd = oldEnd.replace(/\r\n/g, '\n');
    if (normalizedContent.includes(normalizedOldEnd)) {
        content = normalizedContent.replace(normalizedOldEnd, newEnd);
        console.log("Replaced end block (normalized)");
    } else {
        console.log("END BLOCK NOT FOUND");
    }
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log("Done");
