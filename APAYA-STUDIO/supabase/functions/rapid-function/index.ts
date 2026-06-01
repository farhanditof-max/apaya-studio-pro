import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Inisialisasi Kunci Master Supabase (Otomatis ngambil dari server)
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  try {
    // 1. TANGKAP PAKET DARI KIE.AI
    const payload = await req.json()
    console.log("[\u{1F4E6} WEBHOOK MASUK] Data:", payload)

    const data = payload.data
    
    // Pastikan ini paket asli dari Kie.ai (punya taskId)
    if (!data || !data.taskId) {
      return new Response("Bukan paket Kie.ai", { status: 400 })
    }

    const taskId = data.taskId
    const state = data.state // Isinya: 'success' atau 'failed'
    let finalImageUrl = ""

    // 2. BONGKAR JSON BUAT NGAMBIL URL GAMBAR
    if (state === 'success' && data.resultJson) {
      const parsedResult = JSON.parse(data.resultJson)
      if (parsedResult.resultUrls && parsedResult.resultUrls.length > 0) {
        finalImageUrl = parsedResult.resultUrls[0]
      }
    }

    console.log(`[\u{2705} PARSED] Task: ${taskId} | State: ${state} | URL: ${finalImageUrl}`)

    // 3. UPDATE DATABASE LU (Papan Tulis)
    const { error } = await supabase
      .from('ai_render_jobs')
      .update({ 
        status: state, 
        result_b64: finalImageUrl // Kita numpang kolom ini buat nyimpen URL gambar dari Kie.ai
      })
      .eq('kie_job_id', taskId)

    if (error) {
      console.error("[\u{274C} DB ERROR] Gagal nulis ke database:", error)
      throw error
    }

    // 4. KASIH JEMPOL KE KIE.AI (Biar dia tau paket udah diterima)
    return new Response(JSON.stringify({ message: "Paket Diterima Bosku!" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error: any) {
    console.error("[\u{274C} FATAL ERROR]", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})