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
    const url = new URL(req.url);
    const pathSegment = url.pathname.split('/').pop();

    // ==========================================
    // CHECK-STATUS ENDPOINT: Active Kie.ai polling fallback
    // ==========================================
    if (pathSegment === 'check-status' && req.method === 'POST') {
      const { task_id } = await req.json();
      if (!task_id) {
        return new Response(JSON.stringify({ error: 'Missing task_id' }), { status: 400 });
      }

      // First check if DB already has result (webhook might have worked)
      const { data: existingJob } = await supabase
        .from('ai_render_jobs')
        .select('*')
        .eq('kie_job_id', task_id)
        .single();

      if (existingJob && existingJob.status === 'success' && existingJob.result_b64) {
        return new Response(JSON.stringify({ status: 'success', result_url: existingJob.result_b64 }), {
          headers: { 'Content-Type': 'application/json' }, status: 200
        });
      }

      // Active poll Kie.ai directly
      const kieStatusRes = await fetch(`https://api.kie.ai/api/v1/jobs/result/${task_id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${kieApiKey}` }
      });

      const kieResult = await kieStatusRes.json();
      console.log(`[CHECK-STATUS] task=${task_id} | kie response:`, JSON.stringify(kieResult));

      if (kieResult.code === 200 && kieResult.data) {
        const state = kieResult.data.state;
        let finalImageUrl = '';

        if (state === 'success' && kieResult.data.resultJson) {
          const parsed = JSON.parse(kieResult.data.resultJson);
          if (parsed.resultUrls && parsed.resultUrls.length > 0) {
            finalImageUrl = parsed.resultUrls[0];
          }
        }

        // Update DB so normal polling picks it up too
        if (state === 'success' || state === 'failed') {
          await supabase
            .from('ai_render_jobs')
            .update({ status: state, result_b64: finalImageUrl })
            .eq('kie_job_id', task_id);
        }

        return new Response(JSON.stringify({ status: state, result_url: finalImageUrl }), {
          headers: { 'Content-Type': 'application/json' }, status: 200
        });
      }

      return new Response(JSON.stringify({ status: 'pending' }), {
        headers: { 'Content-Type': 'application/json' }, status: 200
      });
    }

    // ==========================================
    // DEFAULT: GENERATE ENDPOINT
    // ==========================================
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
      selectedModel = "google/nano-banana-edit";
      creditCost = 1;
      targetRes = "1K";
    } else if (task_type === "concept") {
      selectedModel = "nano-banana-2";   
      creditCost = 1;                           
      targetRes = "1K";                         
    }
    
    // ==============================================================
    // ⚡ PABRIK PERACIK PROMPT (VERSION 7: HYBRID — V5 QUALITY + V6 STRUCTURE)
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
          // 🔒 UNIVERSAL CONSTRAINT BLOCKS
          // -------------------------------------------------------
          const cameraLockBlock = `
[LOCK] CAMERA & GEOMETRY — NON-NEGOTIABLE:
This image is a SketchUp architectural model. Your job is ONLY to add photorealistic surface quality, lighting, and environment. The camera viewpoint, every wall, floor, ceiling, window, door, furniture piece, and structural element must remain at the EXACT same pixel position, scale, proportion, and angle as the input. Any deviation = rejected output. Do NOT recompose, crop, zoom, pan, or alter perspective in any way.`;

          const materialLockBlock = `
[LOCK] MATERIAL IDENTITY:
Every material visible in the input must keep its SAME category in the output. Wood must stay wood (add grain, pores, finish — but it stays wood). Concrete must stay concrete. Glass must stay glass. Metal must stay metal. You may upgrade the texture fidelity to photorealistic quality, but you must NEVER swap one material category for another (e.g., wood becoming painted wall, concrete becoming marble). Match the approximate color tone of each material from the input.`;

          // -------------------------------------------------------
          // CHECK: MANUAL MODE vs AUTO MODE
          // -------------------------------------------------------
          const isManualMode = pData.manual_prompt && pData.manual_prompt.trim() !== "";

          if (isManualMode) {
              // ===========================================
              // ✍️ MANUAL MODE — User prompt is king
              // ===========================================
              finalKiePrompt = `${pData.manual_prompt}
${cameraLockBlock}
${materialLockBlock}

PHOTOGRAPHIC OUTPUT:
Style: photorealistic, 8k resolution, raw photo, highly detailed, octane render, global illumination, ray tracing, stunning natural lighting.
Output must look like a real photograph — include subtle lens vignette, natural depth-of-field, film-like tonal response (lifted shadows, rolled highlights), and micro surface imperfections. If it looks like CGI, it is WRONG.`;

          } else {
              // ===========================================
              // 🤖 AUTO MODE — Full prompt construction
              // ===========================================

              // -------------------------------------------------------
              // 🏠 CABANG 1: INTERIOR
              // -------------------------------------------------------
              if (pData.env === 'interior') {
                  basePrompt = `You are a professional interior photographer.
TASK: Convert this SketchUp screenshot into a photorealistic interior photograph.
Style: photorealistic, 8k resolution, raw photo, highly detailed, octane render, global illumination, ray tracing, stunning natural lighting, realistic material textures.
${cameraLockBlock}
${materialLockBlock}
${styleBlock}

MATERIAL REALISM:
- Concrete/Plaster: pores, uneven tone, slight discoloration
- Wood: natural grain variation, slight color inconsistency, subtle finish reflection
- Fabric: realistic weave texture, soft light interaction, natural drape
- Glass: imperfect reflections (not mirror clean), subtle smudges
- Metal: subtle roughness, fingerprints on polished surfaces
- Stone/Tile: natural pattern variation, correct grout lines
- Ambient occlusion in corners, under furniture, and ceiling edges

INTERIOR LIGHTING`;

                  if (pData.waktu === 'malam') {
                      basePrompt += ` — NIGHT:
- Warm ambient lighting from ceiling fixtures, table and floor lamps (3200K)
- Soft warm pools of light beneath each fixture
- Deep blue twilight visible through windows
- Cozy intimate atmosphere with high contrast between lit and shadowed areas`;
                  } else if (pData.waktu === 'pagi') {
                      basePrompt += ` — MORNING (GOLDEN HOUR):
- Warm golden morning sunlight entering through windows at low angle
- Long soft shadows stretching across floors
- Gentle warm color temperature (4200K golden hour)
- Soft directional light with warm bounce off walls`;
                  } else {
                      basePrompt += ` — DAYTIME:
- Bright natural daylight flooding through windows
- Soft ambient bounce light filling the room evenly
- Dappled shadows filtering through windows
- Natural color temperature (5600K daylight)`;
                  }

                  if (pData.lampu) basePrompt += `\n- Interior LED strips and accent lamps turned ON, adding warm pools of light`;

                  basePrompt += `

PHOTOGRAPHIC REALISM:
- Subtle lens vignette, micro chromatic aberration on high-contrast edges
- Natural depth-of-field on distant walls, film-like tonal response
- Lifted blacks (never pure black), soft highlight rolloff (never blown white)
- Dust particles in light beams, fabric weave detail, wood grain depth
- Ambient occlusion in room corners, under furniture, ceiling edges
- Correct light bounce from surfaces to adjacent walls`;

              // -------------------------------------------------------
              // 🏢 CABANG 2: EXTERIOR
              // -------------------------------------------------------
              } else {
                  basePrompt = `This building is located in BSD City, Tangerang, Indonesia.
You are a professional architectural photographer.
TASK: Convert this SketchUp screenshot into a photorealistic street-level photograph in BSD City, Indonesia.
Style: photorealistic, 8k resolution, raw photo, sharp focus, octane render, global illumination, hyper-realistic textures, beautiful cinematic sunlight, natural environment integration.
${cameraLockBlock}
${materialLockBlock}
${styleBlock}

ENVIRONMENT — BSD CITY, INDONESIA:
- FOREGROUND FRAMING (MANDATORY): Large Trembesi trees (Samanea saman) with wide spreading canopy framing the left and/or right edge of the shot — branches and leaves partially overlapping the building facade
- Background: lush Indonesian tropical vegetation, mixed green foliage
- Ground: ${pData.waktu === 'malam' ? 'wet asphalt reflecting warm building lights' : 'slightly wet asphalt after light rain'}
- Neighboring structures partially visible, softly obscured by Ketapang Kencana trees
- All vegetation strictly green-toned (dark green, sage, olive) — NO colorful flowers

BUILDING SURFACE REALISM:
- Concrete: pores, uneven tone, slight discoloration, micro stains, subtle rain streaks
- Wood: natural grain variation, slight color inconsistency
- Glass: imperfect reflections (not mirror clean)
- Metal: subtle roughness and patina
- Ambient occlusion in corners, wall joints, and under eaves`;

                  if (pData.waktu === 'malam') {
                      basePrompt += `

LIGHTING — NIGHT (BLUE HOUR / DUSK):
- SKY: deep navy blue to near-black — this is NIGHTTIME, NOT daytime
- Dramatic warm architectural uplighting on facade (3000K warm white)
- All interior rooms glowing warmly through windows (visible warm light spill)
- Street lamps casting warm pools of light on wet asphalt
- Deep contrast between warm light sources and dark shadows
- Stars or faint clouds visible in the dark sky`;
                  } else if (pData.waktu === 'pagi') {
                      basePrompt += `

LIGHTING — MORNING (GOLDEN HOUR):
- Warm golden morning sunlight from the east
- Long dramatic shadows cast by building and Trembesi trees
- Soft warm sky gradient (golden to pale blue)
- Slightly damp asphalt with morning dew reflections
- Trembesi tree shadow patterns on ground and facade`;
                  } else {
                      basePrompt += `

LIGHTING — DAYTIME (AFTER RAIN):
- Soft diffused daylight (slightly overcast / post-rain)
- Trembesi tree shadow dappling on ground and walls
- Realistic bounce light with mix of sunlit and shaded areas
- Slightly wet asphalt with subtle puddle reflections`;
                  }

                  if (pData.lampu) basePrompt += `\n- Warm interior lights glowing softly through windows`;
                  if (pData.kendaraan) basePrompt += `\n- ${pData.kendaraan}`;
                  if (pData.vegetasi) basePrompt += `\n- ${pData.vegetasi}`;

                  basePrompt += `

PHOTOGRAPHIC REALISM:
- Subtle lens vignette, micro chromatic aberration on high-contrast edges
- Natural depth-of-field with soft background bokeh
- Lifted shadows (never pure black), rolled-off highlights (never blown white)
- Hairline cracks in concrete, micro dirt in grout lines, natural weathering
- Correct caustics through glass, light bounce from ground to soffit
- Faint tropical humidity haze in the distance`;
              }

              finalKiePrompt = basePrompt;
          }

       } catch(err) {
          console.error("Gagal parse JSON prompt, pakai prompt mentah:", err);
       }
    }
    // ==============================================================

    // 2. CEK SALDO & POTONG KREDIT — atomic single operation
    // deduct_credits returns NULL jika kredit tidak cukup atau license tidak ditemukan.
    // UPDATE WHERE credits >= cost bersifat atomic di PostgreSQL — aman dari race condition.
    const { data: newCredits, error: deductError } = await supabase
      .rpc('deduct_credits', { p_key: license_key, p_cost: creditCost })

    if (deductError) {
      return new Response(JSON.stringify({ error: 'Database error saat proses kredit.' }), { status: 500 })
    }
    if (newCredits === null) {
      return new Response(JSON.stringify({ error: `Kredit tidak cukup atau license tidak valid. Butuh ${creditCost} kredit.` }), { status: 402 })
    }

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
      // For nano-banana-2 via standard createTask
      const englishPrompt = (prompt.startsWith("change ") || prompt.startsWith("change material ")) ? prompt : `change ${prompt} in image A to ${prompt} in Image B`;
      inputData = {
        prompt: englishPrompt,
        image_input: [image_url, ref_url],
        output_format: "jpg",
        aspect_ratio: "auto",
        resolution: "1K"
      };
      
      selectedModel = "nano-banana-2";
    } else {
      // Default: render / render_4k / concept / alchemist
      inputData = {
        image_input: [image_url],
        aspect_ratio: "auto",
        output_format: "png",
        prompt: finalKiePrompt,
        resolution: targetRes
      };
      // CAMERA FIX: Force controlled denoising. If user set denoise slider, use it.
      // Otherwise default to 0.45 — enough for photorealism, strict enough to preserve camera angle.
      // Kie.ai default is ~0.75 which is way too high and causes camera/geometry drift.
      if (strength !== null && strength !== undefined) {
        inputData.denoising_strength = parseFloat(strength) / 100.0;
      } else {
        inputData.denoising_strength = 0.45;
      }
    }

    // ref_url for render/concept material board (not swap)
    if (ref_url && task_type !== "magic_swap" && task_type !== "motion") {
      inputData.image_input_b = [ref_url];
    }

    let kiePayload: any = {};
    const endpointUrl = "https://api.kie.ai/api/v1/jobs/createTask";

    kiePayload = {
      model: selectedModel, 
      callBackUrl: webhookUrl,
      input: JSON.stringify(inputData)
    };

    console.log(`[APAYA ENGINE] Task: ${task_type} | Model: ${selectedModel} | Res: ${targetRes} | Style: ${style || 'none'} | Cost: ${creditCost}Cr`);
    console.log(`[APAYA DEBUG] image_url: ${image_url ? image_url.substring(0, 80) : 'NULL'}`);
    if (task_type === "magic_swap") {
      console.log(`[SWAP DEBUG] Using stitched image, Prompt: ${inputData.prompt}`);
    }
    console.log(`[APAYA DEBUG] kiePayload endpoint=${endpointUrl}`);


    // ==========================================
    // 5. SERVER SUPABASE NEMBAK KIE.AI
    // ==========================================
    const kieRes = await fetch(endpointUrl, {
      method: "POST", 
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${kieApiKey}` 
      }, 
      body: JSON.stringify(kiePayload)
    });

    const kieData = await kieRes.json();
    console.log(`[KIE RESPONSE] status=${kieRes.status} | body=${JSON.stringify(kieData)}`);

    // flux-kontext-pro returns { code:200, data:{ taskId } }
    // jobs/createTask  returns { code:200, data:{ taskId } }
    // Both should have code===200 and data.taskId — but guard carefully
    const responseCode = kieData.code ?? kieRes.status;
    const taskId = kieData.data?.taskId ?? kieData.taskId ?? null;

    if (responseCode !== 200 || !taskId) {
        // Refund kredit atomic — tambah balik, tidak overwrite nilai saat ini
        await supabase.rpc('refund_credits', { p_key: license_key, p_cost: creditCost });
        throw new Error("Kie.ai error: " + JSON.stringify(kieData));
    }

    // 6. SIMPAN TASK_ID KE TABEL ai_render_jobs BUAT DI-POLLING SAMA SKETCHUP
    await supabase.from('ai_render_jobs').insert([{ 
        kie_job_id: taskId, 
        status: 'pending' 
    }]);

    // 7. BALIKIN STATUS SUCCESS KE SKETCHUP BIAR MULAI POLLING
    return new Response(JSON.stringify({ success: true, taskId: taskId }), { 
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

