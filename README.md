# Apaya Studio Pro

SketchUp Pro extension untuk AI rendering, material swap, dan camera control.

## Stack

| Layer | Tech |
|---|---|
| Extension core | Ruby (SketchUp API) |
| UI dialog | HTML + Vanilla JS |
| Backend | Supabase Edge Functions (TypeScript/Deno) |

## Struktur Project

```
APAYA-STUDIO/
├── main.rb                    # Entry point, callback registration
├── lib/
│   ├── config.rb              # Konstanta & konfigurasi
│   ├── domain/                # Business logic murni
│   │   ├── camera.rb
│   │   ├── composition_grid.rb
│   │   ├── export_job.rb
│   │   └── scene_data.rb
│   ├── infrastructure/        # HTTP, API, storage
│   │   ├── ai_client.rb
│   │   ├── license_manager.rb
│   │   ├── polling_manager.rb
│   │   ├── supabase_client.rb
│   │   └── ...
│   └── interface/             # UI bridge
│       ├── camera_dialog.rb
│       └── ui_gateway.rb      # Typed Ruby→JS bridge
├── ui/
│   ├── dashboard.html         # Main plugin UI
│   ├── AI.html                # AI render dialog
│   └── vendor/fontawesome/    # FA 6.5.1 (bundled lokal)
└── supabase/functions/
    ├── apaya-generate/        # AI image generation
    ├── payment/               # Payment webhook
    └── rapid-function/
```

## Setup Dev

```bash
# Install dev dependencies (LSP + SketchUp API stubs)
bundle install
```

## Install Extension

1. Build `.rbz`: zip `APAYA-STUDIO/` + `APAYA-STUDIO.rb` → rename ke `.rbz`
2. SketchUp → **Extensions > Extension Manager > Install Extension**
3. Pilih file `.rbz`

## Menjalankan di SketchUp

- Ruby Console: `Window > Ruby Console`
- Debug output: `puts` tampil di Ruby Console
- UI reload: tutup + buka dialog dari toolbar

## Supabase Edge Functions

```bash
cd APAYA-STUDIO/supabase
supabase functions serve        # local dev
supabase functions deploy       # deploy ke production
```

