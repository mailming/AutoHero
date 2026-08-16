param(
    [int]$OpponentIndex = 0,
    [string]$OpponentUserId = '',
    [int]$HeroPoolSize = 12,
    [int]$MaxCombinations = 40,
    [int]$SimulationsPerCombo = 10,
    [string]$Label = 'bridge-training',
    [string]$OutputDir = 'arena-training-results',
    [int]$TimeoutMs = 1800000
)

function Invoke-Bridge {
    param(
        [string]$Method,
        [array]$Args = @(),
        [int]$Timeout = 30000
    )
    $body = @{ method = $Method; args = $Args; timeoutMs = $Timeout } | ConvertTo-Json -Compress -Depth 12
    Invoke-RestMethod -Method POST -Uri http://127.0.0.1:9876/run -ContentType 'application/json' -Body $body
}

$health = Invoke-RestMethod http://127.0.0.1:9876/health
if (-not $health.browserConnected) {
    throw 'Bridge browser not connected. Open Hero Wars with LLM Controller + Arena Training loaded.'
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outFile = Join-Path $OutputDir "arena-training-$stamp.json"

$options = @{
    label = $Label
    opponentIndex = $OpponentIndex
    heroPoolSize = $HeroPoolSize
    maxCombinations = $MaxCombinations
    simulationsPerCombo = $SimulationsPerCombo
    includeCurrentTeam = $true
}
if ($OpponentUserId) {
    $options.opponentUserId = $OpponentUserId
    $options.Remove('opponentIndex')
}

Write-Host "Starting arena training vs opponent index $OpponentIndex..."
$result = Invoke-Bridge -Method 'arenaTrainingRun' -Args @($options) -Timeout $TimeoutMs
$result | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $outFile

if ($result.best) {
    Write-Host "Best combo: $($result.best.heroNames -join ', ') + pet $($result.best.pet)"
    Write-Host "Win rate: $([math]::Round($result.best.winRate, 1))% ($($result.best.wins)/$($result.best.wins + $result.best.losses))"
}
Write-Host "Saved to $outFile"
