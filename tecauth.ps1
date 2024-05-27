
# Check for --help
if ($args[0] -eq "--help") {
  Write-Host "Usage: ./tecauth.ps1 [username] [password]"
  Write-Host "Logs into the Eternal City game and copies the response cookie value to the clipboard."
  Write-Host "Options:"
  Write-Host "  --help    Display this help message and exit."
  exit
}

# Session, Cookie, and URI required for the login request
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$cookie = New-Object System.Net.Cookie
$cookie.Name = "biscuit"
$cookie.Value = "test"
$cookie.Domain = $uri.Host
$session.Cookies.Add($cookie)
$uri = [System.Uri]"https://login.eternalcitygame.com/login.php"

# Fetch the cookie from the login page
Invoke-WebRequest `
	-Uri $uri `
	-Method POST `
	-Body @{"submit"="true"; "uname"=$args[0]; "pwd"=$args[1]} `
	-WebSession $session | Out-Null

# Get the server's pass hash value from the `pass` cookie
$cookies = $session.Cookies.GetCookies($uri)
foreach ($cookie in $cookies) {
	if ($cookie.Name -eq "pass") {
			$passhash = $cookie.Value
			break
	}
}

Write-Host "Passhash: $passhash"

# This is the md5 hash of username, passhash, and the secret "NONE".
$md5hash = Get-FileHash `
	-Algorithm MD5 `
	-InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($args[0] + $passhash + "NONE")))

$lowercasemd5hash = $md5hash.Hash.ToLower()

Write-Host "Hash: $($lowercasemd5hash)"

# Copy to the clipboard
$lowercasemd5hash | Set-Clipboard
