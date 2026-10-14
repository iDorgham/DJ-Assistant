$content = Get-Content "D:\Work\AI\Projects\DJ Assistant\crates\analysis\tests\golden.rs" -Raw
$lines = $content -split "`n"

$startIdx = -1
$endIdx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -like "fn run_fixture*") {
        $startIdx = $i
        break
    }
}

if ($startIdx -ge 0) {
    $braceCount = 0
    for ($i = $startIdx; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -contains "{") {
            $braceCount++
        }
        if ($lines[$i] -contains "}") {
            $braceCount--
            if ($braceCount -eq 0) {
                $endIdx = $i
                break
            }
        }
    }
}

if ($startIdx -ge 0 -and $endIdx -ge 0) {
    $assertIdx = -1
    for ($i = $startIdx; $i -le $endIdx; $i++) {
        if ($lines[$i] -like "    assert_eq!(") {
            $assertIdx = $i
            break
        }
    }
    
    if ($assertIdx -ge 0) {
        $debugLines = @(
            "    // Debug info when assertion fails",
            "    if status != expected.analysis_status {",
            "        eprintln!(\"{} \\\"analysis_status\\\" mismatch: expected \\\"{}\\\", got \\\"{}\\\"\", label, expected.analysis_status, status);",
            "        eprintln!(\"  results.bpm: {:?}\", results.bpm);",
            "        eprintln!(\"  results.key_camelot: {:?}\", results.key_camelot);",
            "        eprintln!(\"  results.key_classical: {:?}\", results.key_classical);",
            "        eprintln!(\"  results.loudness_lufs: {:?}\", results.loudness_lufs);",
            "        eprintln!(\"  results.phrase_confidence: {:?}\", results.phrase_confidence);",
            "        eprintln!(\"  results.errors: {:?}\", results.errors);",
            "    }"
        )
        
        $newLines = @()
        for ($i = 0; $i -lt $lines.Length; $i++) {
            if ($i -eq $assertIdx) {
                $newLines += $debugLines
            }
            $newLines += $lines[$i]
        }
        
        $newLines -join "`n" | Set-Content "D:\Work\AI\Projects\DJ Assistant\crates\analysis\tests\golden.rs"
    }
}
