import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const supabase = createClient(supabaseUrl, supabaseServiceKey)
const kieApiKey = Deno.env.get('KIE_API_KEY') as string
const webhookUrl = "https://adnhrddsleheanayszbc.supabase.co/functions/v1/rapid-function"

// ==========================================
// STYLE PALETTE DICTIONARY
// ==========================================
const STYLE_PROMPTS: Record<string, string> = {
  "modern_luxury": "Modern luxury aesthetic: clean geometric lines, premium materials such as marble with natural veining, brushed brass accents, rich dark walnut wood, neutral palette with warm gold highlights, sophisticated minimalism.",
  "modern_classic": "Modern classic aesthetic: blend of traditional elegance and contemporary lines, wainscoting, neutral palette with subtle contrasts, refined furniture, crystal accents, bright and luxurious.",
  "classic": "Classic aesthetic: traditional architectural details, ornate moldings, rich mahogany wood, antique brass, intricate patterns, warm and timeless atmosphere.",
  "japandi": "Japandi aesthetic: Japanese-Scandinavian fusion, light natural oak, matte ceramic, wabi-sabi imperfections, earth tones (warm beige, soft clay, muted sage), organic simplicity, serene minimalism.",
  "industrial": "Industrial raw aesthetic: exposed red brick walls, raw concrete surfaces, matte black steel beams and fixtures, reclaimed wood, warm Edison bulb lighting, utilitarian charm with loft character.",
  "tropical": "Tropical modern aesthetic: lush green foliage, natural rattan and woven bamboo, teak wood, terracotta accents, bright airy interiors with abundant natural light, resort-like atmosphere."
};

serve(async (req) => {
  try {
    const { license_key, prompt, image_url, ref_url, mask_url, task_type, style, strength } = await req.json()

    // ==============================================================
    // 1. TENTUKAN HARGA, MODEL & RESOLUSI BERDASARKAN TASK TYPE
    // ==============================================================
    let selectedModel = "nano-banana-2"; 
    let creditCost = 1;                         
    let targetRes = "1K";                       

    if (task_type === "render") {
      selectedModel = "nano-banana-2"; 
      creditCost = 1;                           
      targetRes = "2K";                         
    } else if (task_type === "render_4k") {
      selectedModel = "nano-banana-2"; 
      creditCost = 2;                           
      targetRes = "4K";                         
    } else if (task_type === "alchemist") {
      selectedModel = "nano-banana-2";   
      creditCost = 1;                           
      targetRes = "1K"; 
        } else if (task_type === "motion") {
      selectedModel = "kling-2.6/image-to-video";
      creditCost = 3;
    } else if (task_type === "magic_swap") {
      selectedModel = "nano-banana-2";
      creditCost = 1;
      targetRes = "1K";
    } else if (task_type === "concept") {
      selectedModel = "nano-banana-2";   
      creditCost = 1;                           
      targetRes = "1K";                         
    }
    
    // ==============================================================
    // ⚡ PABRIK PERACIK PROMPT (VERSION 4: STRUCTURE + FIDELITY)
    // ==============================================================
    let finalKiePrompt = prompt; // Default buat Alchemist

    if (task_type === "render" || task_type === "render_4k" || task_type === "concept") {
       try {
          const pData = JSON.parse(prompt);
          let basePrompt = "";

          // -------------------------------------------------------
          // STYLE INJECTION
          // -------------------------------------------------------
          const styleBlock = (style && STYLE_PROMPTS[style]) ? `\nDESIGN STYLE: ${STYLE_PROMPTS[style]}` : "";

          // -------------------------------------------------------
          // 🏠 CABANG 1: INTERIOR
          // -------------------------------------------------------
          if (pData.env === 'interior') {
              basePrompt = `You are a professional interior photographer using a Sony A7III with a 24mm lens.
AUTOMATIC MODE: Convert this SketchUp screenshot into a real interior photograph.

STRICT RULES:
- DO NOT change building structure, geometry, proportions, or layout
- DO NOT redesign architecture or move any element
- KEEP everything exactly as original
- LOCK camera position, perspective, and composition
${styleBlock}

ANTI-CGI REALISM (CRITICAL)
- Break perfect clean CG look
- Add subtle dust, micro scratches, and natural wear
- Avoid perfect sharp edges — slight edge softness
- Surfaces must have real-world imperfections

MATERIAL REALISM
- Concrete/Plaster: pores, uneven tone, slight discoloration
- Wood: natural grain variation, slight color inconsistency, subtle finish reflection
- Fabric: realistic weave texture, soft light interaction, natural drape
- Glass: imperfect reflections (not mirror clean), subtle smudges
- Metal: subtle roughness, fingerprints on polished surfaces
- Stone/Tile: natural pattern variation, correct grout lines
- Add light ambient occlusion in corners, under furniture, and ceiling edges

INTERIOR LIGHTING`;

              if (pData.waktu === 'malam') {
                  basePrompt += `
- Warm ambient lighting from ceiling fixtures and table/floor lamps
- Soft warm pools of light beneath each fixture (3200K)
- Deep blue twilight visible through windows
- Cozy intimate atmosphere`;
              } else if (pData.waktu === 'pagi') {
                  basePrompt += `
- Warm golden morning sunlight entering through windows at low angle
- Long soft shadows stretching across floors
- Gentle warm color temperature (4500K golden hour)
- Soft directional light with warm bounce`;
              } else {
                  basePrompt += `
- Bright natural daylight flooding through windows
- Soft ambient bounce light filling the room evenly
- Dappled shadows filtering through windows
- Natural color temperature (5600K daylight)`;
              }

              if (pData.lampu) basePrompt += `\n- Interior LED strips and accent lamps turned ON, adding warm pools of light`;

          // -------------------------------------------------------
          // 🏢 CABANG 2: EXTERIOR
          // -------------------------------------------------------
          } else {
              basePrompt = `This building is located in BSD, Indonesia.
You are a professional architectural photographer using a Sony A7III with a 35mm lens.
AUTOMATIC MODE: Convert this SketchUp screenshot into a real street-level photograph in BSD, Indonesia.

STRICT RULES:
- DO NOT change building structure, geometry, proportions, or layout
- DO NOT redesign architecture
- DO NOT replace materials with completely different ones
- KEEP everything exactly as original
- LOCK camera position, perspective, and composition
${styleBlock}

ANTI-CGI REALISM (CRITICAL)
- Break perfect clean CG look
- Add subtle dirt, dust, and weathering on surfaces
- Slight stains and tonal variation
- Avoid perfect sharp edges — slight edge softness

BUILDING REALISM
- Concrete: pores, uneven tone, slight discoloration, micro stains
- Add very subtle rain streaks and aging marks
- Wood: natural grain variation, slight color inconsistency
- Glass: imperfect reflections (not mirror clean)
- Metal: subtle roughness and patina
- Add light ambient occlusion in corners and joints
- Slight shadow buildup in wall intersections`;

              if (pData.waktu === 'malam') {
                  basePrompt += `

LIGHTING (NIGHT - BLUE HOUR / DUSK)
- SKY MUST BE DARK: deep navy blue to near-black sky, NOT daytime blue
- This is NIGHTTIME — if the sky looks bright or daytime, it is WRONG
- Dramatic warm architectural uplighting on facade (3000K warm white)
- All interior rooms glowing warmly through windows (visible warm light spill)
- Street lamps casting warm pools of light on wet asphalt
- Subtle ambient fill ONLY from dark twilight sky, NOT from sunlight
- Wet asphalt reflecting warm building lights against dark surroundings
- Deep contrast between warm light sources and dark shadows
- Stars or faint clouds visible in the dark sky`;
              } else if (pData.waktu === 'pagi') {
                  basePrompt += `

LIGHTING (MORNING - GOLDEN HOUR)
- Warm golden morning sunlight from the east
- Long dramatic shadows cast by building
- Soft warm sky gradient
- Slightly damp asphalt with morning dew reflections
- Tree shadow patterns on ground`;
              } else {
                  basePrompt += `

LIGHTING (DAYTIME - AFTER RAIN)
- Soft daylight after rain (slightly diffused sunlight)
- Tree shadow patterns (dappled shadows)
- Realistic bounce light with mix of sunlit and shaded areas
- Slightly wet asphalt with subtle puddle reflections`;
              }

              basePrompt += `

ENVIRONMENT
- Foreground framing: Trembesi (Samanea saman) tree branches framing the shot
- Background: lush Indonesian tropical vegetation
- Ground: slightly wet asphalt after light rain
- Neighboring houses partially visible, softly obscured by Ketapang Kencana trees
- VEGETATION COLOR RULE: All plants and trees must be GREEN-toned only (dark green, sage, olive)
- DO NOT add bougainvillea, frangipani, hibiscus, or any brightly-colored flowering plants
- NO magenta, pink, purple, red, or orange flowers anywhere in the scene
- Keep vegetation realistic and muted — typical BSD residential neighborhood plants`;
              
              if (pData.lampu) basePrompt += `\n- Warm interior lights glowing softly through windows`;
              if (pData.kendaraan) basePrompt += `\n- ${pData.kendaraan}`;
              if (pData.vegetasi) basePrompt += `\n- ${pData.vegetasi}`;
          }

          // -------------------------------------------------------
          // 📸 CAMERA & FINAL
          // -------------------------------------------------------
          finalKiePrompt = basePrompt;

          finalKiePrompt += `

CAMERA (SONY A7III SIMULATION)
- Full-frame sensor look
- Slight natural lens distortion
- Very subtle sensor noise
- Natural depth of field

COLOR & TONE
- Natural photographic color grading
- Slightly increased vibrance
- Rich contrast without HDR look

FINAL RESULT
- Must look like a real photograph, NOT a render
- If it looks like CGI, it is WRONG
- If any geometry changes from the original, it is WRONG`;

          // GABUNGIN PROMPT MANUAL USER
          if (pData.manual_prompt && pData.manual_prompt.trim() !== "") {
              finalKiePrompt += `\n\nCUSTOM DETAILS:\n${pData.manual_prompt}`;
          }

       } catch(err) {
          console.error("Gagal parse JSON prompt, pakai prompt mentah:", err);
       }
    }
    // ==============================================================

    // 2. CEK SALDO LISENSI
    const { data: licenseData, error: licenseError } = await supabase
      .from('licenses')
      .select('credits')
      .eq('license_key', license_key)
      .single()

    if (licenseError || !licenseData) { 
      return new Response(JSON.stringify({ error: "License tidak valid" }), { status: 401 }) 
    }
    if (licenseData.credits < creditCost) { 
      return new Response(JSON.stringify({ error: `Kredit tidak cukup. Butuh ${creditCost} kredit.` }), { status: 402 }) 
    }

    // 3. POTONG SALDO ASLI DI DATABASE
    await supabase.from('licenses').update({ credits: licenseData.credits - creditCost }).eq('license_key', license_key)

    // ==========================================
    // 4. RAKIT PESANAN BUAT KIE.AI
    // ==========================================
    // PENTING: Kie.ai butuh "input" sebagai STRING (JSON yang di-stringify),
    // BUKAN sebagai object langsung.

    let inputData: any = {};

    if (task_type === "motion") {
      // Kling image-to-video API: needs "image_urls" (NOT "image_input")
      inputData = {
        prompt: finalKiePrompt || "Slow cinematic camera movement with soft ambient lighting",
        image_urls: [image_url],
        duration: "5",
        sound: false
      };
    } else if (task_type === "magic_swap") {
      // nano-banana-2 inpainting: needs mask + reference image
      inputData = {
        image_input: [image_url],
        prompt: finalKiePrompt,
        resolution: targetRes
      };
      if (mask_url) inputData.mask_image = [mask_url];
      if (ref_url) inputData.image_input_b = [ref_url];
    } else {
      // Default: render / render_4k / concept / alchemist
      inputData = {
        image_input: [image_url],
        aspect_ratio: "auto",
        output_format: "png",
        prompt: finalKiePrompt,
        resolution: targetRes
      };
      if (strength !== null && strength !== undefined) {
        inputData.denoising_strength = parseFloat(strength) / 100.0;
      }
    }

    // ref_url for render/concept material board (not swap)
    if (ref_url && task_type !== "magic_swap" && task_type !== "motion") {
      inputData.image_input_b = [ref_url];
    }

    const kiePayload: any = {
      model: selectedModel, 
      callBackUrl: webhookUrl,
      input: JSON.stringify(inputData)
    };

    console.log(`[APAYA ENGINE] Task: ${task_type} | Model: ${selectedModel} | Res: ${targetRes} | Style: ${style || 'none'} | Cost: ${creditCost}Cr`);
    console.log(`[APAYA DEBUG] Prompt length: ${(finalKiePrompt || "").length} chars`);
    console.log(`[APAYA DEBUG] image_url: ${image_url ? image_url.substring(0, 80) : 'NULL'}`);
    console.log(`[APAYA DEBUG] Payload structure: model=${selectedModel}, input=STRING(${JSON.stringify(inputData).length} chars)`);

    // ==========================================
    // 5. SERVER SUPABASE NEMBAK KIE.AI
    // ==========================================
    const kieRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST", 
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${kieApiKey}` 
      }, 
      body: JSON.stringify(kiePayload)
    });

    const kieData = await kieRes.json();
    if (kieData.code !== 200 || !kieData.data?.taskId) {
        // Refund kredit kalau Kie.ai gagal
        await supabase.from('licenses').update({ credits: licenseData.credits }).eq('license_key', license_key);
        throw new Error("Kie.ai error: " + JSON.stringify(kieData));
    }

    // 6. SIMPAN TASK_ID KE TABEL ai_render_jobs BUAT DI-POLLING SAMA SKETCHUP
    await supabase.from('ai_render_jobs').insert([{ 
        kie_job_id: kieData.data.taskId, 
        status: 'pending' 
    }]);

    // 7. BALIKIN STATUS SUCCESS KE SKETCHUP BIAR MULAI POLLING
    return new Response(JSON.stringify({ success: true, taskId: kieData.data.taskId }), { 
        headers: { "Content-Type": "application/json" }, 
        status: 200 
    });

  } catch (err) {
    console.error("Fatal Error Edge Function:", err);
    return new Response(JSON.stringify({ error: err.message }), { 
        headers: { "Content-Type": "application/json" }, 
        status: 500 
    });
  }
});

