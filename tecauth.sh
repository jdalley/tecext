#!/bin/bash

# Check for --help
if [[ $1 == "--help" ]]; then
  echo "Usage: ./tecauth.sh [username] [password]"
  echo "Logs into the Eternal City game and copies the response cookie value to the clipboard."
  echo "Options:"
  echo "  --help    Display this help message and exit."
  exit 0
fi

# Fetch the cookie from the login page.
tempFile=$(mktemp)
data=$(curl --ssl-no-revoke \
	 -X POST "https://login.eternalcitygame.com/login.php" \
	 -b "biscuit=test" \
	 -c $tempFile \
	 -d "submit=true" \
	 -d "uname=$1" \
	 -d "pwd=$2" )

# Get the server's pass hash value from the 7th "column" of the cookie.
cookie=$(cat $tempFile)
passhash=$(echo "${cookie}" | awk '/pass/ {print $7}')
echo -e "Passhash: ${passhash}"

# This is the md5 hash of username, passhash, and the secret "NONE".
md5hash=$(echo -n "${1}${passhash}NONE" | md5sum | awk '{print $1}')
echo -e "Hash: ${md5hash}"

# Copy to the clipboard
# Note: clip.exe used here as this is a WSL Ubuntu script
echo $md5hash | clip.exe
