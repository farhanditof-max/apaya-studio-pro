import json
import re

log_path = r"C:\Users\farha\.gemini\antigravity\brain\5fdffefa-e0fc-4c1e-821d-0f4705f6d16b\.system_generated\logs\transcript.jsonl"
target_file = r"K:\Project\## PLUGINS APAYA\APAYA-STUDIO\ui\dashboard.html"

# Read the corrupted file to get the lines before and after the diff
with open(target_file, "r", encoding="utf-8") as f:
    corrupted_lines = f.readlines()

# Find the multi_replace_file_content response in transcript
diff_text = ""
with open(log_path, "r", encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get("type") == "MULTI_REPLACE_FILE_CONTENT" and "dashboard.html" in data.get("content", ""):
                diff_text = data["content"]
        except Exception:
            pass

if not diff_text:
    print("Diff not found in transcript!")
    exit(1)

# Extract the deleted lines from the diff
# The diff starts after [diff_block_start]
in_diff = False
original_lines = []
for line in diff_text.splitlines():
    if line.startswith("[diff_block_start]"):
        in_diff = True
        continue
    if in_diff:
        if line.startswith("-") or line.startswith(" "):
            # Remove the prefix
            original_lines.append(line[1:] + "\n")
        elif line.startswith("@@"):
            pass # header
        elif line.startswith("+"):
            pass # inserted line

print(f"Recovered {len(original_lines)} lines from the diff.")

# The diff started at line 604. 
# In the corrupted file, line 0 to 602 are intact.
prefix = corrupted_lines[:603]

# The diff ended at line 1198.
# In the corrupted file, the inserted chunk ended at 603 + 308 = 911 (since it says @@ -604,111 +604,308 @@ ? No wait, the diff says: @@ -604,595 +604,308 @@ maybe?)
# Actually, we can just find where the suffix starts. The suffix is everything AFTER the deleted block.
# Let's just find a unique line from the end of the deleted block.
# The end of the deleted block in the original file was:
#        function updateBASlider(val) { document.getElementById('img-after').style.clipPath = `inset(0 0 0 ${val}%)`; document.getElementById('ba-handle').style.left = val + '%'; }
#        function updateRenderBASlider(val) { document.getElementById('r-img-after').style.clipPath = `inset(0 0 0 ${val}%)`; document.getElementById('r-ba-handle').style.left = val + '%'; }
# So the suffix in the corrupted file starts right after the inserted block.

# Wait, if I just replace lines 603 to (603 + length of inserted block) with the original_lines, it will be perfect!
# But how many lines were inserted?
# The diff header says: @@ -604,X +604,Y @@
match = re.search(r"@@ -\d+,(\d+) \+\d+,(\d+) @@", diff_text)
if match:
    deleted_count = int(match.group(1))
    inserted_count = int(match.group(2))
    print(f"Diff header says: {deleted_count} deleted, {inserted_count} inserted.")
    
    suffix = corrupted_lines[603 + inserted_count:]
    
    with open(target_file + ".recovered.html", "w", encoding="utf-8") as f:
        f.writelines(prefix)
        f.writelines(original_lines)
        f.writelines(suffix)
    print("Recovered file written to dashboard.html.recovered.html")
else:
    print("Could not parse diff header")

