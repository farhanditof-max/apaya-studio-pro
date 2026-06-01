const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let src = fs.readFileSync(TARGET, 'utf8');

const oldPayloadStr = `    payload = {
      license_key: license_key,
      prompt: full_prompt,
      image_url: public_url_a,
      ref_url: public_url_b,
      task_type: task_type
    }`;

const newPayloadStr = `    payload = {
      license_key: license_key,
      prompt: full_prompt,
      image_url: public_url_a,
      ref_url: public_url_b,
      task_type: task_type
    }
    if task_type == 'magic_swap'
      payload[:resolution] = "1K"
      payload[:aspect_ratio] = "auto"
      payload[:output_format] = "jpg"
    end`;

if (src.includes(oldPayloadStr)) {
    src = src.replace(oldPayloadStr, newPayloadStr);
    fs.writeFileSync(TARGET, src, 'utf8');
    console.log("Updated payload to include explicit fields for magic_swap.");
} else {
    console.log("Could not find payload string.");
}
