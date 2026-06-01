import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const MIDTRANS_SERVER_KEY = Deno.env.get('MIDTRANS_SERVER_KEY') ?? '';

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
      const { license_key, amount, price: clientPrice } = await req.json();

      if (!license_key || !amount) {
        return new Response(JSON.stringify({ error: 'Missing license_key or amount' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      // Use price from frontend if provided, otherwise fallback to per-credit pricing
      const price = clientPrice || (amount * 5000);

      // Generate a unique transaction ID to be used as Midtrans order_id
      const transactionId = crypto.randomUUID();

      const midtransUrl = 'https://app.midtrans.com/snap/v1/transactions';
      const authString = btoa(`${MIDTRANS_SERVER_KEY}:`);
      
      const payload = {
        transaction_details: {
          order_id: transactionId,
          gross_amount: price
        },
        credit_card: {
          secure: true
        },
        custom_field1: license_key
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
          license_key: license_key,
          amount: amount,
          price: price,
          status: 'pending',
          snap_token: snapToken
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
        console.error("Invalid Midtrans Signature");
        // Midtrans test notification might fail if we return 403. Returning 200 prevents retries for bad requests.
        return new Response(JSON.stringify({ error: 'Invalid signature', detail: 'Signature mismatch' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
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

      // If status changed to settled, and it wasn't already settled, we give credit
      if (shouldAddCredit && tx.status !== 'settled') {
        // 1. Update transaction status
        await supabase
          .from('transactions')
          .update({ status: 'settled', updated_at: new Date().toISOString() })
          .eq('id', order_id);

        // 2. Fetch current credits
        const { data: license, error: licenseError } = await supabase
          .from('licenses')
          .select('credits')
          .eq('license_key', tx.license_key)
          .single();

        if (license && !licenseError) {
          const newCredits = (license.credits || 0) + tx.amount;
          // 3. Update credits
          await supabase
            .from('licenses')
            .update({ credits: newCredits, updated_at: new Date().toISOString() })
            .eq('license_key', tx.license_key);
        }
      } else if (newStatus !== tx.status) {
        // Just update status
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
