param([ValidateSet('', '1', '2', '3')][string]$Choice = '')

$ErrorActionPreference = 'Stop'
$keyDirectory = Join-Path $env:LOCALAPPDATA 'ClassAiHelper'
$keyFile = Join-Path $keyDirectory 'openai-key.txt'

if (-not $Choice) {
    Write-Host '1. Start the app'
    Write-Host '2. Save or replace the OpenAI API key'
    Write-Host '3. Delete the saved API key'
    $Choice = Read-Host 'Choose 1, 2 or 3'
}

if ($choice -eq '3') {
    if (Test-Path -LiteralPath $keyFile) {
        Remove-Item -LiteralPath $keyFile
        Write-Host 'Saved key deleted. The app is disconnected from OpenAI.'
    } else {
        Write-Host 'There is no saved key.'
    }
    return
}

if ($choice -notin @('1', '2')) {
    Write-Host 'Invalid choice.'
    return
}

if ($choice -eq '2' -or -not (Test-Path -LiteralPath $keyFile)) {
    $secret = Read-Host 'Enter the OpenAI API key' -AsSecureString
    try {
        if ($secret.Length -eq 0) { throw 'No API key entered.' }
        New-Item -ItemType Directory -Path $keyDirectory -Force | Out-Null
        ConvertFrom-SecureString -SecureString $secret |
            Set-Content -LiteralPath $keyFile -Encoding ASCII
        Write-Host 'Key encrypted and saved for this Windows account.'
    } finally {
        $secret.Dispose()
    }
}

if ($choice -eq '2') { return }

$secret = Get-Content -LiteralPath $keyFile | ConvertTo-SecureString
$originalKey = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'Process')
$originalKeyFile = [Environment]::GetEnvironmentVariable('CLASS_HELPER_KEY_FILE', 'Process')
try {
    $env:CLASS_HELPER_KEY_FILE = $keyFile
    $env:OPENAI_API_KEY = [System.Net.NetworkCredential]::new('', $secret).Password.Trim()
    Write-Host 'Press Ctrl+C here to stop the app.'
    & node (Join-Path $PSScriptRoot 'server.mjs') --open
} finally {
    [Environment]::SetEnvironmentVariable('OPENAI_API_KEY', $originalKey, 'Process')
    [Environment]::SetEnvironmentVariable('CLASS_HELPER_KEY_FILE', $originalKeyFile, 'Process')
    $secret.Dispose()
}
