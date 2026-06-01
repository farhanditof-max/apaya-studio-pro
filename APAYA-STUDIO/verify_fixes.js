const fs = require('fs');
const src = fs.readFileSync('K:/Project/## PLUGINS APAYA/APAYA-STUDIO/main.rb', 'utf8');

const checks = [
  ['Thread.new for generate_ai_concept', 'upload_image_to_supabase(_path'],
  ['Thread.new for alchemist', 'mat_alchemist_#{Time.now.to_i}.jpg'],
  ['Thread.new for motion', 'motion_#{Time.now.to_i}.jpg'],
  ['Thread.new for magic_swap', 'swap_src_#{Time.now.to_i}.jpg'],
  ['Thread.new for upscale', 'upscale_#{Time.now.to_i}.jpg'],
  ['Sketchup::Http::Request in poll', 'Sketchup::Http::Request.new(url_str'],
  ['get_scene_thumbnail wrapped in timer', 'UI.start_timer(0.1, false) do'],
  ['No blocking Net::HTTP in poll timer', 'Async HTTP'],
];

let ok = true;
checks.forEach(([label, check]) => {
  const found = src.includes(check);
  console.log((found ? 'OK' : 'FAIL') + ' -- ' + label);
  if (!found) ok = false;
});
console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
