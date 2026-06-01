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
    } else if (task_type === "upscale") {
      selectedModel = "nano-banana-2";
      creditCost = 2;
      targetRes = "4K";
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
          // STYLE & CUSTOM PROMPT INJECTION
          // -------------------------------------------------------
          const styleBlock = (style && STYLE_PROMPTS[style]) ? `\nDESIGN STYLE: ${STYLE_PROMPTS[style]}` : "";
          const customPromptBlock = (pData.manual_prompt && pData.manual_prompt.trim() !== "") 
              ? `\n\nCUSTOM USER REQUEST:\n${pData.manual_prompt}\n` 
              : "";

          // -------------------------------------------------------
          // 🏠 CABANG 1: INTERIOR
          // -------------------------------------------------------
          if (pData.env === 'interior') {
              basePrompt = `You are a professional interior photographer using a Sony A7III with a 24mm lens.
AUTOMATIC MODE: Convert this SketchUp screenshot into a real interior photograph.
${customPromptBlock}
CRITICAL:
Preserve the exact room geometry, proportions, layout, and camera perspective from the input image.
Do not redesign the architecture or move any furniture.

STYLE:
${styleBlock}

REALISM:
Make the image look like a real DSLR photograph, not CGI.
Add subtle imperfections, realistic material texture variation, and soft edge imperfections.

LIGHTING:`;

              if (pData.waktu === 'malam') {
                  basePrompt += `
Warm ambient lighting from ceiling fixtures and table/floor lamps.
Deep blue twilight visible through windows.
Cozy intimate atmosphere.`;
              } else if (pData.waktu === 'pagi') {
                  basePrompt += `
Morning golden hour.
Warm golden sunlight entering through windows at low angle.
Soft directional light with warm bounce.`;
              } else {
                  basePrompt += `
Bright natural daylight flooding through windows.
Soft ambient bounce light filling the room evenly.`;
              }

              if (pData.lampu) basePrompt += `\nInterior LED strips and accent lamps turned ON, adding warm pools of light.`;

          // -------------------------------------------------------
          // 🏢 CABANG 2: EXTERIOR
          // -------------------------------------------------------
          } else {
              basePrompt = `This building is located in BSD, Indonesia.

Transform this exact SketchUp screenshot into a realistic street-level architectural photograph in BSD, Indonesia.

CRITICAL:
Preserve the exact building geometry, layout, proportions, and camera perspective from the input image.
Do not redesign the architecture.
${customPromptBlock}
STYLE:
${styleBlock}

REALISM:
Make the image look like a real DSLR photograph, not CGI.
Add subtle realistic texture variation and soft edge imperfections. Keep the building looking clean and well-maintained.

LIGHTING:`;

              if (pData.waktu === 'malam') {
                  basePrompt += `
Nighttime dusk / blue hour.
Dramatic warm architectural uplighting on facade (3000K).
All interior rooms glowing warmly through windows.
Street lamps casting warm pools of light on wet asphalt.`;
              } else if (pData.waktu === 'pagi') {
                  basePrompt += `
Morning golden hour after light rain.
Warm sunlight with slightly wet reflective surfaces.`;
              } else {
                  basePrompt += `
Soft daylight after rain (slightly diffused sunlight).
Realistic bounce light with slightly wet asphalt.`;
              }

              basePrompt += `

ENVIRONMENT:
Typical BSD residential neighborhood with muted tropical vegetation and Ketapang Kencana roadside trees.
Use Trembesi (Samanea saman) trees as natural foreground framing for the camera.
Avoid colorful flowers.
Strictly follow the original hardscape and landscape geometry. Do not hallucinate extra grass or lawns that cover modeled pavements.`;
              
              if (pData.lampu) basePrompt += `\nWarm interior lights glowing softly through windows.`;
              if (pData.kendaraan) basePrompt += `\nVehicle: ${pData.kendaraan}`;
              if (pData.vegetasi) basePrompt += `\nVegetation: ${pData.vegetasi}`;
          }

          // -------------------------------------------------------
          // 📸 CAMERA & FINAL
          // -------------------------------------------------------
          finalKiePrompt = basePrompt;

          finalKiePrompt += `

CAMERA:
Professional Sony A7III architectural photography look.
Natural lens behavior and realistic depth of field.

COLOR:
Natural photographic color grading with rich contrast and realistic tones.

FINAL RESULT:
Prioritize photorealism while preserving the original SketchUp geometry and composition.`;

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

