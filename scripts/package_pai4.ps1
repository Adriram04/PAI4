param(
    [Parameter(Mandatory = $true)]
    [string]$TeamNumber
)

$zipName = "PAI4-ST$TeamNumber.zip"
$projectRoot = Split-Path -Parent $PSScriptRoot
$zipPath = Join-Path $projectRoot $zipName
$stagingDir = Join-Path $env:TEMP ("pai4_stage_" + [guid]::NewGuid().ToString("N"))

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$pathsToInclude = @(
    "app",
    "tests",
    "k8s",
    "docs",
    "scripts",
    ".github",
    "reports",
    "Dockerfile",
    "docker-compose.yml",
    "requirements.txt",
    "requirements-dev.txt",
    "README.md",
    "Makefile",
    "zap-rules.tsv"
)

$resolved = @()
foreach ($relativePath in $pathsToInclude) {
    $fullPath = Join-Path $projectRoot $relativePath
    if (Test-Path $fullPath) {
        $resolved += @{ Relative = $relativePath; Full = $fullPath }
    }
}

New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null
$stagingDir = (Get-Item -LiteralPath $stagingDir).FullName

foreach ($item in $resolved) {
    $destination = Join-Path $stagingDir $item.Relative
    if ((Get-Item $item.Full) -is [System.IO.DirectoryInfo]) {
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
        Copy-Item -Path (Join-Path $item.Full "*") -Destination $destination -Recurse -Force
    }
    else {
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -Path $item.Full -Destination $destination -Force
    }
}

Get-ChildItem -Path $stagingDir -Recurse -Directory -Force |
    Where-Object { $_.Name -in @("__pycache__", ".pytest_cache") } |
    Remove-Item -Recurse -Force

Get-ChildItem -Path $stagingDir -Recurse -File -Force |
    Where-Object { $_.Extension -in @(".pyc", ".pyo") } |
    Remove-Item -Force

Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath
Remove-Item -Path $stagingDir -Recurse -Force
Write-Host "ZIP generado: $zipPath"

