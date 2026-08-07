param(
    [string]$ServerRoot = "$PSScriptRoot\minecraft-server-1.21.8"
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'dialogue-resource-pack'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$name = "RPGMaker-Pack-$stamp.zip"
$output = Join-Path $ServerRoot $name
$jar = 'C:\Program Files\Java\jdk-21\bin\jar.exe'

& $jar --create --file $output -C $source .
if ($LASTEXITCODE -ne 0) { throw 'Resource-pack build failed.' }

$sha1 = (Get-FileHash -LiteralPath $output -Algorithm SHA1).Hash.ToLowerInvariant()
$uuid = [guid]::NewGuid().ToString()
$propertiesPath = Join-Path $ServerRoot 'server.properties'
$properties = Get-Content -LiteralPath $propertiesPath -Raw -Encoding UTF8
$currentPack = ([regex]::Match($properties, '(?m)^resource-pack=(.+)$')).Groups[1].Value
$packBase = if ($currentPack.Contains('/')) { $currentPack.Substring(0, $currentPack.LastIndexOf('/')) } else { 'http\://172.30.1.34\:25566' }
$properties = $properties -replace '(?m)^resource-pack=.*$', "resource-pack=$packBase/$name"
$properties = $properties -replace '(?m)^resource-pack-id=.*$', "resource-pack-id=$uuid"
$properties = $properties -replace '(?m)^resource-pack-sha1=.*$', "resource-pack-sha1=$sha1"
Set-Content -LiteralPath $propertiesPath -Value $properties -Encoding UTF8

$configPath = Join-Path $ServerRoot 'plugins\RPGMaker\config.yml'
$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8
if ($config -match '(?m)^pack-file:') {
    $config = $config -replace '(?m)^pack-file:.*$', "pack-file: $name"
} else {
    $config += "`npack-file: $name`n"
}
Set-Content -LiteralPath $configPath -Value $config -Encoding UTF8

Write-Host "Built $name"
Write-Host "UUID  $uuid"
Write-Host "SHA1  $sha1"
Write-Host 'Restart the server to serve and require the new pack.'
