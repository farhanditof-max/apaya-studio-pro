# 1. Dashboard merge base — versi kita, bukan snapshot Gemini

**Status:** Accepted
**Date:** 2026-06-22
**Context-spec:** `docs/superpowers/specs/2026-06-22-batch-frontend-merge-split-design.md`

## Context

Fitur Batch Render + AI Auto Prompt (Gemini Vision) dibangun agent lain. Frontend-nya final, snapshot di `docs/product/Instruction for Agents- 20 June/Interactive UI Mockup.html`.

Snapshot itu **diverge** dari `APAYA-STUDIO/ui/dashboard.html` live kita:

| | LIVE `dashboard.html` | Snapshot Gemini |
|---|---|---|
| Batch render frontend | tidak ada | ada |
| Pricing | baru (135k/200k, sudah deployed) | lama (100k/150k) |
| Email flow | lebih lengkap (44 ref) | kurang (9 ref) |
| Tour guide / license modal | ada | ada (sama) |

Dua-duanya monolith. Harus digabung jadi satu canonical dashboard, sekalian dipecah modular (SRP) per spec `2026-06-10-frontend-modularization.md`.

Pertanyaan: mana yang jadi **base** merge?

## Decision

**Base = `dashboard.html` KITA.** Snapshot Gemini = **donor fitur batch** yang di-port masuk sebagai modul SRP baru (`batch-render.js`, `gemini-vision.js`), diadaptasi ke konvensi kita.

Aturan rekonsiliasi: konten kita = base, batch = additive. Diff feature-by-feature, never overwrite wholesale.

## Alternatives Considered

1. **Snapshot Gemini sebagai base, graft pricing kita** — ditolak. Snapshot punya pricing lama + email flow lebih sedikit → fitur kita (email flow lengkap, pricing baru yang sudah deployed) bakal hilang/mundur. Re-apply email+pricing ke snapshot = effort lebih besar + risk silent loss.
2. **Versi kita sebagai base, port batch (dipilih)** — batch = additive, masuk sebagai modul baru terisolasi. Fitur+pricing kita aman. Risk terlokalisir di modul batch baru.

## Consequences

- Fitur kita (email, tour, license, pricing 135k/200k) terjaga otomatis — tidak perlu di-re-apply.
- Kerja port = isolasi batch Gemini ke 2 modul baru + adaptasi konvensi (event delegation, dummy-mode gate/simulate, plain-global contract surface).
- Future dev yang lihat 2 versi dashboard tahu kenapa versi kita menang: kita lebih maju di fitur+pricing, batch cuma 1 area yang kita belum punya.
- Konsekuensi pricing: snapshot Gemini (pricing lama) TIDAK boleh di-copy wholesale — selalu base dari versi kita.
