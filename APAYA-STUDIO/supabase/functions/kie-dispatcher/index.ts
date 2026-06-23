import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const supabase = createClient(supabaseUrl, supabaseServiceKey)
const kieApiKey = Deno.env.get('KIE_API_KEY') as string

const MAX_PER_BATCH = 20

serve(async (_req) => {
  try {
    // Ambil max 20 job queued, FIFO
    const { data: jobs, error: fetchError } = await supabase
      .from('ai_render_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(MAX_PER_BATCH)

    if (fetchError) throw fetchError
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0, message: 'No queued jobs' }), { status: 200 })
    }

    console.log(`[DISPATCHER] Processing ${jobs.length} queued jobs`)

    let dispatched = 0
    let failed = 0

    for (const job of jobs) {
      try {
        const { kiePayload, endpointUrl } = job.payload

        // Optimistic lock — hanya update kalau masih 'queued' (cegah double dispatch)
        const { data: locked } = await supabase
          .from('ai_render_jobs')
          .update({ status: 'processing', dispatched_at: new Date().toISOString() })
          .eq('id', job.id)
          .eq('status', 'queued')
          .select('id')

        if (!locked || locked.length === 0) {
          console.log(`[DISPATCHER] Job ${job.id} already claimed, skip`)
          continue
        }

        // Tembak Kie.ai
        const kieRes = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${kieApiKey}`
          },
          body: JSON.stringify(kiePayload)
        })

        const kieData = await kieRes.json()
        console.log(`[DISPATCHER] Job ${job.id}: Kie.ai code=${kieData.code ?? kieRes.status}`)

        const responseCode = kieData.code ?? kieRes.status
        const taskId = kieData.data?.taskId ?? kieData.taskId ?? null

        if (responseCode === 200 && taskId) {
          await supabase
            .from('ai_render_jobs')
            .update({ kie_job_id: taskId })
            .eq('id', job.id)
          console.log(`[DISPATCHER] Job ${job.id} → Kie taskId=${taskId}`)
          dispatched++
        } else {
          await supabase
            .from('ai_render_jobs')
            .update({ status: 'failed' })
            .eq('id', job.id)
          await supabase.rpc('refund_credits', { p_key: job.license_key, p_cost: job.credits })
          console.log(`[DISPATCHER] Job ${job.id} Kie.ai error: ${JSON.stringify(kieData)}`)
          failed++
        }
      } catch (jobErr: unknown) {
        const msg = jobErr instanceof Error ? jobErr.message : String(jobErr)
        console.error(`[DISPATCHER] Job ${job.id} exception: ${msg}`)
        await supabase.from('ai_render_jobs').update({ status: 'failed' }).eq('id', job.id)
        await supabase.rpc('refund_credits', { p_key: job.license_key, p_cost: job.credits }).catch(() => {})
        failed++
      }
    }

    return new Response(JSON.stringify({ dispatched, failed, total: jobs.length }), { status: 200 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DISPATCHER] Fatal:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
