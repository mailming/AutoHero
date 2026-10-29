param(
    [string]$Label = "manual-ui",
    [string]$OutputDir = "api-captures",
    [int]$PollSeconds = 2,
    [int]$DurationMinutes = 0
)

function Invoke-Bridge {
    param(
        [string]$Method,
        [array]$Args = @(),
        [int]$TimeoutMs = 30000
    )
    $body = @{ method = $Method; args = $Args; timeoutMs = $TimeoutMs } | ConvertTo-Json -Compress -Depth 12
    Invoke-RestMethod -Method POST -Uri http://127.0.0.1:9876/run -ContentType 'application/json' -Body $body
}

$health = Invoke-RestMethod http://127.0.0.1:9876/health
if (-not $health.browserConnected) {
    throw 'Bridge browser not connected. Open Hero Wars with LLM Controller v1.3+ loaded.'
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$sessionStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$sessionDir = Join-Path $OutputDir $sessionStamp
New-Item -ItemType Directory -Force -Path $sessionDir | Out-Null

Write-Host "Starting API recording: $Label"
$start = Invoke-Bridge -Method 'startApiRecording' -Args @(@{ label = $Label })
$start | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $sessionDir 'session-start.json')

$lastId = 0
$deadline = if ($DurationMinutes -gt 0) { (Get-Date).AddMinutes($DurationMinutes) } else { $null }

try {
    while ($true) {
        if ($deadline -and (Get-Date) -gt $deadline) {
            Write-Host 'Duration reached, stopping recording.'
            break
        }

        $chunk = Invoke-Bridge -Method 'getApiRecording' -Args @(@{ sinceId = $lastId })
        if ($chunk.entries.Count -gt 0) {
            $chunkFile = Join-Path $sessionDir ("chunk-{0}.json" -f (Get-Date -Format 'HHmmss'))
            $chunk | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $chunkFile
            $lastId = $chunk.lastEntryId
            Write-Host ("Captured {0} new API calls (total id {1})" -f $chunk.entries.Count, $lastId)
        }

        Start-Sleep -Seconds $PollSeconds
    }
}
finally {
    $final = Invoke-Bridge -Method 'stopApiRecording'
    $export = Invoke-Bridge -Method 'exportApiRecording'
    $final | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $sessionDir 'session-stop.json')
    $export | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 (Join-Path $sessionDir 'recording-full.json')
    Write-Host "Saved recording to $sessionDir"
}
