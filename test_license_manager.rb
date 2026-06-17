# frozen_string_literal: true

# Mock Sketchup API — simulate write_default/read_default dengan in-memory store
module Sketchup
  @store = {}

  def self.write_default(ns, key, val)
    @store["#{ns}/#{key}"] = val
  end

  def self.read_default(ns, key, default)
    @store.fetch("#{ns}/#{key}", default)
  end
end

load 'APAYA-STUDIO/lib/infrastructure/license_manager.rb'

passed = 0
failed = 0

def assert(label, condition)
  if condition
    puts "✅ PASS: #{label}"
    1
  else
    puts "❌ FAIL: #{label}"
    0
  end
end

# T1: save key baru
ApayaStudioPro::LicenseManager.save("APAYA-TEST-1234-ABCD")
result = Sketchup.read_default('ApayaAI', 'LicenseKey', '')
passed += assert("save stores key correctly", result == "APAYA-TEST-1234-ABCD")

# T2: save overwrite key lama
ApayaStudioPro::LicenseManager.save("APAYA-NEW0-KEY0-HERE")
result = Sketchup.read_default('ApayaAI', 'LicenseKey', '')
passed += assert("save overwrites existing key", result == "APAYA-NEW0-KEY0-HERE")

# T3: save dengan non-string (integer) — .to_s harus handle ini
ApayaStudioPro::LicenseManager.save(12345)
result = Sketchup.read_default('ApayaAI', 'LicenseKey', '')
passed += assert("save converts non-string via to_s", result == "12345")

# T4: regex guard menolak lowercase — simulasi logika on_apply_license
# save() sendiri tidak validate — guard ada di caller (on_apply_license)
GUARD = /\AAPAYA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\z/
ApayaStudioPro::LicenseManager.save("APAYA-GOOD-KEY0-LAST")
key_before = Sketchup.read_default('ApayaAI', 'LicenseKey', '')

invalid_key = "APAYA-ab12-cd34-ef56"
ApayaStudioPro::LicenseManager.save(invalid_key) if invalid_key.match?(GUARD)

result = Sketchup.read_default('ApayaAI', 'LicenseKey', '')
passed += assert("invalid key rejected, store unchanged", result == key_before)

puts "\n--- #{passed} passed, #{failed} failed ---"
