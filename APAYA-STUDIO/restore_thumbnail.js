const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let src = fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');

// Lines 734-740 (1-indexed) = indices 733-739 (0-indexed)
// We need to replace these broken lines:
// 734: @dialog.add_action_callback("get_scene_thumbnail") do |_, cam_name|
// 735:   begin
// 736:     page = Sketchup.active_model.pages[cam_name]
// 737:     if page
// 738:     # ------... CALLBACK: TRIGGER GENERATE AI CONCEPT / RENDER
// 739:     # ---------------------------------------------------------
// 740:     @dialog.add_action_callback("generate_ai_concept") do |_, params|
//
// We need to replace lines 734-739 (0-indexed 733-738) with the full working thumbnail callback
// and KEEP line 740+ (generate_ai_concept) intact

console.log('Lines before replacement:');
for (let i = 733; i <= 742; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

const replacement = `    @dialog.add_action_callback("get_scene_thumbnail") do |_, cam_name|
      begin
        page = Sketchup.active_model.pages[cam_name]
        if page
          model = Sketchup.active_model
          view = model.active_view
          prev_trans = model.options["PageOptions"]["ShowTransition"]
          model.options["PageOptions"]["ShowTransition"] = false
          model.pages.selected_page = page

          stored_ratio = page.get_attribute('ApayaAI', 'aspect_ratio')
          ratio = stored_ratio ? stored_ratio.to_f : 1.0
          view.camera.aspect_ratio = ratio

          w = ratio >= 1.0 ? 1920 : (1920 * ratio).to_i
          h = ratio >= 1.0 ? (1920 / ratio).to_i : 1920

          temp_dir = File.join(__dir__, 'temp')
          FileUtils.mkdir_p(temp_dir)
          temp_img_path = File.join(temp_dir, "before_\#{cam_name}.png")

          view.write_image(temp_img_path, w, h, true)
          model.options["PageOptions"]["ShowTransition"] = prev_trans

          if File.exist?(temp_img_path)
            safe_url = ("file:///" + temp_img_path.gsub('\\\\', '/').gsub(' ', '%20').gsub('#', '%23') + "?t=\#{Time.now.to_i}").to_json
            @dialog.execute_script("setBeforeImage(\#{safe_url});")
          else
            puts "[THUMBNAIL] File tidak terbuat: \#{temp_img_path}"
          end
        end
      rescue => e
        puts "[THUMBNAIL ERROR] \#{e.message}"
        puts e.backtrace.first(3).join("\\n")
      end
    end

    # ---------------------------------------------------------
    # CALLBACK: TRIGGER GENERATE AI CONCEPT / RENDER
    # ---------------------------------------------------------`;

// Replace lines 733-739 (0-indexed, inclusive) — that's 7 lines
// Line 740 (0-indexed 739) is the generate_ai_concept callback — keep that
lines.splice(733, 7, replacement);

const result = lines.join('\n').replace(/\n/g, '\r\n');
fs.writeFileSync(TARGET, result, 'utf8');
console.log('\n✅ Done. Total lines now:', lines.length);
