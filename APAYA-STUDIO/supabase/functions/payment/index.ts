import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const MIDTRANS_SERVER_KEY = Deno.env.get('MIDTRANS_SERVER_KEY') ?? '';

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomChar = (): string => {
    while (true) {
      const b = new Uint8Array(1);
      crypto.getRandomValues(b);
      // Rejection sampling: buang byte >= 252 untuk eliminasi modulo bias
      // 252 = 7*36, sehingga distribusi 0-251 ke 36 chars = uniform
      if (b[0] < 252) return chars[b[0] % 36];
    }
  };
  const seg = () => Array.from({ length: 4 }, randomChar).join('');
  return `APAYA-${seg()}-${seg()}-${seg()}`;
}

async function sendLicenseEmail(email: string, licenseKey: string, isNewUser: boolean): Promise<void> {
  const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c: string) =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c] ?? c));
  const safeKey = escapeHtml(licenseKey);

  const subject = isNewUser
    ? 'License Key Apaya Studio Pro kamu'
    : 'Topup Kredit Berhasil — Apaya Studio Pro';

  const html = isNewUser
    ? `<h2>Pembayaran berhasil!</h2>
       <p>License key kamu: <strong>${safeKey}</strong></p>
       <p>Masukkan key ini ke plugin Apaya Studio Pro untuk mengaktifkan kredit.</p>
       <p style="color:#f59e0b;font-size:12px;">⚠️ Screenshot atau copy key ini — tidak bisa dipulihkan tanpa email ini.</p>`
    : `<h2>Topup berhasil!</h2>
       <p>Kredit sudah ditambahkan ke license key: <strong>${safeKey}</strong></p>`;

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) throw new Error('RESEND_API_KEY not configured');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Apaya Studio <onboarding@resend.dev>',
      to: email,
      subject,
      html
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error: ${res.status} — ${errText}`);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. CREATE PAYMENT ENDPOINT
    if (path === 'create-payment' && req.method === 'POST') {
      const body = await req.json();
      const trimmedKey = (body.license_key ?? '').trim().toUpperCase();
      const amount = body.amount;
      const customer_email = body.customer_email;
      const emailRegex = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/;

      if (!amount || !customer_email || !emailRegex.test(customer_email)) {
        return new Response(JSON.stringify({ error: 'Missing amount or valid customer_email' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      // Harga selalu dihitung server-side — jangan pernah trust price dari client
      const price = amount * 5000;

      // Generate a unique transaction ID to be used as Midtrans order_id
      const transactionId = crypto.randomUUID();

      const isSandbox = MIDTRANS_SERVER_KEY.startsWith('SB-');
      const midtransUrl = isSandbox
        ? 'https://api.sandbox.midtrans.com/snap/v1/transactions'
        : 'https://app.midtrans.com/snap/v1/transactions';
      const authString = btoa(`${MIDTRANS_SERVER_KEY}:`);
      
      const payload = {
        transaction_details: {
          order_id: transactionId,
          gross_amount: price
        },
        credit_card: {
          secure: true
        },
        customer_details: {
          email: customer_email
        },
        custom_field1: trimmedKey
      };

      const midtransRes = await fetch(midtransUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Basic ${authString}`
        },
        body: JSON.stringify(payload)
      });

      if (!midtransRes.ok) {
        const errorText = await midtransRes.text();
        console.error("Midtrans Error:", errorText);
        return new Response(JSON.stringify({ error: 'Failed to create payment gateway transaction', detail: errorText }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }

      const snapData = await midtransRes.json();
      const snapToken = snapData.token;
      const redirectUrl = snapData.redirect_url;

      // Save to Supabase transactions table
      const { error: dbError } = await supabase
        .from('transactions')
        .insert({
          id: transactionId,
          license_key: trimmedKey || null,
          amount: amount,
          price: price,
          status: 'pending',
          snap_token: snapToken,
          customer_email: customer_email
        });

      if (dbError) {
        console.error("Supabase Error:", dbError);
        return new Response(JSON.stringify({ error: 'Failed to save transaction to database', detail: dbError }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }

      return new Response(JSON.stringify({ snap_token: snapToken, redirect_url: redirectUrl, order_id: transactionId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 2. MIDTRANS WEBHOOK ENDPOINT
    if (path === 'midtrans-webhook' && req.method === 'POST') {
      const payload = await req.json();
      
      const {
        order_id,
        status_code,
        gross_amount,
        signature_key,
        transaction_status,
        fraud_status
      } = payload;

      // Verify Signature Key
      // SHA512(order_id+status_code+gross_amount+ServerKey)
      const dataToHash = `${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(dataToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-512', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashHex !== signature_key) {
        console.error("Invalid Midtrans Signature — possible fake webhook attempt");
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      // Fetch transaction from DB to get amount and license_key
      const { data: tx, error: fetchTxError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', order_id)
        .single();

      if (fetchTxError || !tx) {
        console.error("Transaction not found:", order_id);
        return new Response(JSON.stringify({ error: 'Transaction not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      let newStatus = tx.status;
      let shouldAddCredit = false;

      if (transaction_status == 'capture') {
        if (fraud_status == 'accept') {
          newStatus = 'settled';
          shouldAddCredit = true;
        }
      } else if (transaction_status == 'settlement') {
        newStatus = 'settled';
        shouldAddCredit = true;
      } else if (transaction_status == 'cancel' || transaction_status == 'deny' || transaction_status == 'expire') {
        newStatus = 'expired';
      } else if (transaction_status == 'pending') {
        newStatus = 'pending';
      }

      if (shouldAddCredit) {
        // VULN-1 FIX: Atomic guard — hanya proses jika status masih 'pending'.
        // Midtrans kadang kirim webhook duplikat. UPDATE WHERE status='pending'
        // hanya sukses sekali — webhook kedua mendapat atomicUpdate.length === 0, skip.
        const { data: atomicUpdate } = await supabase
          .from('transactions')
          .update({ status: 'settled', updated_at: new Date().toISOString() })
          .eq('id', order_id)
          .eq('status', 'pending')
          .select('id');

        if (atomicUpdate && atomicUpdate.length > 0) {
          // Server-side check: apakah license_key benar-benar ada di DB?
          // Tidak bisa rely hanya pada tx.license_key — bisa kosong (Unlicensed User).
          const licenseExists = tx.license_key
            ? (await supabase.from('licenses').select('license_key').eq('license_key', tx.license_key).single()).data
            : null;
          const isNewUser = !licenseExists;

          let finalKey = '';

          if (isNewUser) {
            // Generate key + INSERT atomic. Retry jika collision (sangat jarang: 36^12 space).
            let attempt = 0;
            let inserted = false;

            while (attempt < 5 && !inserted) {
              const newKey = generateLicenseKey();
              const { error: insertErr } = await supabase
                .from('licenses')
                .insert({ license_key: newKey, credits: tx.amount });

              if (!insertErr) {
                finalKey = newKey;
                inserted = true;
              } else if (insertErr.code === '23505') {
                // Unique constraint violation — collision, coba key baru
                attempt++;
              } else {
                console.error('[LICENSE INSERT ERROR]', insertErr);
                attempt++;
              }
            }

            if (!inserted) {
              console.error(`[CRITICAL] License key generation failed after 5 attempts for order ${order_id}`);
              return new Response(JSON.stringify({ error: 'License key generation failed' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
              });
            }
          } else {
            // Licensed User — tambah kredit ke license yang ada.
            // NOTE: 'refund_credits' naming menyesatkan — ini TAMBAH kredit (topup), bukan kembalikan.
            // Rename ke 'add_credits' adalah tech debt — out of scope sekarang.
            await supabase.rpc('refund_credits', { p_key: tx.license_key, p_cost: tx.amount });
            finalKey = tx.license_key;
          }

          // Update final_license_key di transaction record
          await supabase
            .from('transactions')
            .update({ final_license_key: finalKey })
            .eq('id', order_id);

          // Send email — fire-and-forget, tidak block response ke Midtrans
          try {
            if (tx.customer_email) {
              await sendLicenseEmail(tx.customer_email, finalKey, isNewUser);
              await supabase.from('transactions').update({ email_sent: true }).eq('id', order_id);
            }
          } catch (emailErr) {
            const emailErrMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
            console.error(`[EMAIL FAILED] order ${order_id}: ${emailErrMsg}`);
            // email_sent tetap false — traceable via Supabase logs + DB query
          }
        }
        // else: webhook duplikat — silent skip (sudah diproses sebelumnya)
      } else if (newStatus !== tx.status) {
        await supabase
          .from('transactions')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', order_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Default fallback
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
})
