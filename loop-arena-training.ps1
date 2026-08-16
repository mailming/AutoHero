param(
    [string]$Label = 'auto-loop',
    [int]$HeroPoolSize = 12,
    [int]$MaxCombinations = 20,
    [int]$SimulationsPerCombo = 5,
    [int]$DelaySeconds = 2,
    [int]$MaxRounds = 0,
    [int]$StatusIntervalSeconds = 30
)

function Invoke-Bridge {
    param(
        [string]$Method,
        [array]$Args = @(),
        [int]$Timeout = 15000
    )
    $body = @{ method = $Method; args = $Args; timeoutMs = $Timeout } | ConvertTo-Json -Compress -Depth 12
    Invoke-RestMethod -Method POST -Uri http://127.0.0.1:9876/run -ContentType 'application/json' -Body $body
}

$health = Invoke-RestMethod http://127.0.0.1:9876/health
if (-not $health.browserConnected) {
    throw 'Bridge not connected. Open Hero Wars with LLM Controller + Arena Training loaded.'
}

$options = @{
    label = $Label
    heroPoolSize = $HeroPoolSize
    maxCombinations = $MaxCombinations
    simulationsPerCombo = $SimulationsPerCombo
    delayBetweenRoundsMs = $DelaySeconds * 1000
    saveToBridge = $true
    repeatCycle = $true
    maxRounds = $MaxRounds
}

Write-Host 'Starting arena loop training (results auto-save to arena-training-results/)...'
$start = Invoke-Bridge -Method 'arenaTrainingStartLoop' -Args @($options)
$start | ConvertTo-Json -Depth 6

Write-Host ''
Write-Host 'Loop is running in the browser. Press Ctrl+C to stop.'
Write-Host ''

try {
    while ($true) {
        Start-Sleep -Seconds $StatusIntervalSeconds
        $status = Invoke-Bridge -Method 'arenaTrainingGetStatus'
        $summary = Invoke-RestMethod http://127.0.0.1:9876/training/summary
        Write-Host ("[{0}] loop={1} round={2} savedFiles={3} latest={4}" -f (
            (Get-Date).ToString('HH:mm:ss'),
            $status.loopRunning,
            $status.roundCount,
            $summary.roundFiles,
            $summary.latestFile
        ))
        if (-not $status.loopRunning -and $status.roundCount -gt 0) {
            Write-Host 'Loop finished.'
            break
        }
    }
}
finally {
    Write-Host 'Stopping loop...'
    Invoke-Bridge -Method 'arenaTrainingStopLoop' | Out-Null
    $summary = Invoke-RestMethod http://127.0.0.1:9876/training/summary
    Write-Host "Saved $($summary.roundFiles) round files in $($summary.dir)"
}
