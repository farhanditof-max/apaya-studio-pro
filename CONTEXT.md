# CONTEXT.md — Apaya Studio Pro

Glossary domain terms untuk plugin ini. Bukan spec, bukan implementation detail — hanya definisi istilah yang dipakai konsisten di seluruh codebase, docs, dan percakapan.

---

## Terms

**Orchestrator**
`main.rb`. Titik masuk plugin. Bertanggung jawab atas: requires, dialog setup, `on_*` callbacks, menu registration. Tidak boleh berisi business logic — hanya koordinasi antar service.

**Service Layer**
Kumpulan file di `lib/infrastructure/` dan `lib/domain/`. Tiap file = satu tanggung jawab. Orchestrator memanggil service, service tidak memanggil orchestrator.

**Infrastructure**
Layer `lib/infrastructure/`. Berisi code yang bicara ke sistem eksternal: HTTP calls ke Supabase, file I/O, AI API. Boleh import `lib/config.rb`, tidak boleh import layer lain.

**Domain**
Layer `lib/domain/`. Berisi code yang model state SketchUp: scene attributes, export job, camera control, composition grid. Tidak boleh import infrastructure atau interface.

**UiGateway**
`lib/interface/ui_gateway.rb`. Typed contract antara Ruby dan JavaScript. Semua `execute_script` calls lewat sini — tidak ada raw string tersebar di codebase. Tiap JS function punya satu named Ruby method.

**on_* Callbacks**
Method di `main.rb` yang di-trigger saat JS memanggil Ruby via `sketchup.callback_name()`. Contoh: `on_verify_license`, `on_generate_ai`. Ini adalah controller layer — tidak boleh berisi logic, hanya orchestrate service calls.

**Dead Code Window**
Periode antara Wave 1-3 dan Wave 4 refactor. Implementasi lama di `main.rb` masih ada tapi sudah tidak dipanggil — call sites sudah update ke service baru. Dihapus di Wave 4.

**Wave**
Unit eksekusi refactor. Tiap wave dimulai dengan git commit, diakhiri dengan test manual di SketchUp sebelum lanjut wave berikutnya.

**Anon Key**
Supabase anon key yang didistribusikan bersama file `.rbz`. Public by design — keamanan dijaga RLS, bukan dengan menyembunyikan key. Lihat `lib/config.rb`.

**License Key**
String unik format `APAYA-XXXX-XXXX-XXXX` (kapital alfanumerik). Identifier utama user di sistem. Satu user = satu license key. Disimpan lokal via `Sketchup.write_default` dan di tabel `licenses` Supabase.

**Unlicensed User**
User yang belum memiliki license key. Input `license-key-input` kosong. Saat topup: backend generate license key baru, user terima key via modal + email.

**Licensed User**
User yang sudah memiliki license key. Saat topup: credit bertambah ke license yang sudah ada, tidak ada key baru di-generate.

**Credit**
Unit konsumsi untuk **output generatif AI** — render, 4K render, concept, magic swap, video. Tersimpan di kolom `credits` tabel `licenses`. Berkurang saat user generate output, bertambah saat topup. **Bukan** untuk analisa/pre-processing: lihat **AI Auto Prompt**.

**AI Auto Prompt**
Langkah vision analysis **GRATIS** (tidak makan Credit). Mode ketiga di Tab Render (`AUTO | MANUAL | AI`). Gemini 3.1 Pro (via Kie.ai) menganalisa screenshot viewport SketchUp, deteksi material/finishing/lighting, lalu inject hasilnya ke Master Prompt secara silent di backend. User hanya isi nama ruangan. Prompt hasil inject = rahasia dapur, tidak pernah tampil di UI. Yang berbayar = render hasilnya, bukan analisanya.

**Batch Render**
Pilih multiple kamera via checkbox → render AI berurutan dengan 2 concurrent jobs. Punya queue visual (minimize/blink), disclaimer popup sebelum eksekusi, dan live append (tambah kamera ke antrian yang sedang jalan). Credit = jumlah view × cost per view. Cancel hanya untuk item yang belum terkirim ke Kie.ai — yang sudah terkirim/selesai tidak refund.

**Transaction**
Record pembayaran di tabel `transactions`. Dibuat saat user mulai checkout, diupdate webhook Midtrans saat payment settled. Berisi `status`, `final_license_key`, `customer_email`, `email_sent`. Anon tidak bisa akses langsung — hanya via RPC `check_transaction_status(uuid)`.
