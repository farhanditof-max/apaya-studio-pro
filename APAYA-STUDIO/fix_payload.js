const fs = require('fs');
const TARGET = 'K:\\Project\\## PLUGINS APAYA\\APAYA-STUDIO\\main.rb';
let src = fs.readFileSync(TARGET, 'utf8');

const oldBodyBlock = `    request.body = {
      license_key: license_key,
      prompt: full_prompt,
      image_url: public_url_a,
      ref_url: public_url_b,
      mask_url: mask_url,
      task_type: task_type,
      style: style,
      strength: denoise
    }.to_json`;

const newBodyBlock = `    payload = {
      license_key: license_key,
      prompt: full_prompt,
      image_url: public_url_a,
      ref_url: public_url_b,
      task_type: task_type
    }
    payload[:mask_url] = mask_url if mask_url && !mask_url.empty?
    payload[:style] = style if style && !style.empty?
    payload[:strength] = denoise if denoise && !denoise.empty?
    
    request.body = payload.to_json`;

if (src.includes(oldBodyBlock)) {
    src = src.replace(oldBodyBlock, newBodyBlock);
    fs.writeFileSync(TARGET, src, 'utf8');
    console.log("Updated request.body construction in main.rb");
} else {
    // maybe different indent or formatting
    console.log("oldBodyBlock not found");
}
