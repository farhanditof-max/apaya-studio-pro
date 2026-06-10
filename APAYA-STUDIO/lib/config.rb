# frozen_string_literal: true

module ApayaStudioPro
  # Anon key didistribusikan bersama plugin (.rbz) — ini desain yang disengaja.
  # Plugin berjalan embedded di SketchUp (client-side), tidak ada server secret store.
  # Keamanan ditegakkan via Row Level Security (RLS) di Supabase, bukan lewat menyembunyikan key.
  # Override key: Sketchup.write_default("ApayaAI", "SupabaseKey", "key-baru")
  # Rotation policy: setiap 12 bulan atau jika dicurigai bocor.
  module ApayaConfig
    extend self

    SUPABASE_URL = "https://adnhrddsleheanayszbc.supabase.co"
    SUPABASE_KEY_DEFAULT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbmhyZGRzbGVoZWFuYXlzemJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDI0OTUsImV4cCI6MjA5NDQxODQ5NX0.VIqzviMFG_XbeQ_Tpq2Sfv3KNjGuUSIdp7ZLlzDe3lo"

    def supabase_url
      SUPABASE_URL
    end

    def supabase_key
      override = Sketchup.read_default("ApayaAI", "SupabaseKey", "")
      override.empty? ? SUPABASE_KEY_DEFAULT : override
    end
  end
end
