function getSpotifyAuthLink() {
  const CLIENT_ID = "YOUR_CLIENT_ID";
  const REDIRECT_URI = "YOUR_REDIRECT_URI";

  const url = "https://accounts.spotify.com/authorize" +
    "?client_id=" + encodeURIComponent(CLIENT_ID) +
    "&response_type=code" +
    "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
    "&scope=" + encodeURIComponent("playlist-modify-public playlist-modify-private");

  Logger.log(url);
}

// Copy the generated URL from the log and open it in your browser to authorize the app.