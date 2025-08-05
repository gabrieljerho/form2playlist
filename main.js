const CLIENT_ID = "YOUR_CLIENT_ID";
const CLIENT_SECRET = "YOUR_CLIENT_SECRET";
const REDIRECT_URI = "YOUR_REDIRECT_URI";
const PLAYLIST_ID = "YOUR_PLAYLIST_ID";

/** 
 * 
 * Exchange authorization code for access and refresh tokens. 
 */
function getSpotifyTokens() {
  const authCode = "YOUR_AUTHORIZATION_CODE_from_auth.js";
  const tokenUrl = "https://accounts.spotify.com/api/token";

  const payload = {
    grant_type: "authorization_code",
    code: authCode,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  };

  const options = {
    method: "post",
    payload: payload
  };

  const response = UrlFetchApp.fetch(tokenUrl, options);
  const data = JSON.parse(response.getContentText());

  Logger.log("Access Token: " + data.access_token);
  Logger.log("Refresh Token: " + data.refresh_token);

  PropertiesService.getScriptProperties().setProperty("SPOTIFY_REFRESH_TOKEN", data.refresh_token);
}

/**
 * Refresh and return a new access token using the saved refresh token.
 */
function getSpotifyAccessToken() {
  const refreshToken = PropertiesService.getScriptProperties().getProperty("SPOTIFY_REFRESH_TOKEN");
  const tokenUrl = "https://accounts.spotify.com/api/token";

  const headers = {
    Authorization: "Basic " + Utilities.base64Encode(CLIENT_ID + ":" + CLIENT_SECRET)
  };

  const payload = {
    grant_type: "refresh_token",
    refresh_token: refreshToken
  };

  const options = {
    method: "post",
    payload: payload,
    headers: headers
  };

  const response = UrlFetchApp.fetch(tokenUrl, options);
  const data = JSON.parse(response.getContentText());
  return data.access_token;
}

/**
 * Parse a raw song input string into track and artist using common delimiters.
 */
function parseTrackAndArtist(input) {
  const delimiters = [" by ", " - ", " / ", " – "];
  const lowerInput = input.toLowerCase();

  let lastIndex = -1;
  let lastDelimiter = null;

  for (const delim of delimiters) {
    const index = lowerInput.lastIndexOf(delim);
    if (index > lastIndex) {
      lastIndex = index;
      lastDelimiter = delim;
    }
  }

  if (lastIndex === -1) {
    // No delimiter found
    return {
      track: input.trim(),
      artist: null,
    };
  }

  return {
    track: input.slice(0, lastIndex).trim(),
    artist: input.slice(lastIndex + lastDelimiter.length).trim(),
  };
}

/**
 * Search Spotify for a track based on input and return the best-matching track URI.
 */
function searchSpotifyTrack(rawInput, token) {
  const parsed = parseTrackAndArtist(rawInput);

  const queries = [];

  if (parsed.artist) {
    queries.push(`track:"${parsed.track}" artist:"${parsed.artist}"`);
    queries.push(`"${parsed.track} ${parsed.artist}"`);
  }
  queries.push(rawInput);

  const searchSpotify = (query) => {
    Logger.log("Trying query: " + query);
    const url = "https://api.spotify.com/v1/search?q=" + encodeURIComponent(query) + "&type=track&limit=5";
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": "Bearer " + token }
    });
    return JSON.parse(response.getContentText()).tracks.items;
  };

  let items = [];
  for (const query of queries) {
    items = searchSpotify(query);
    if (items.length > 0) break;
  }

  if (items.length === 0) {
    Logger.log("No tracks found for: " + rawInput);
    return null;
  }

  if (parsed.artist) {
    const lowerArtist = parsed.artist.toLowerCase();
    for (const item of items) {
      const itemArtists = item.artists.map(a => a.name.toLowerCase()).join(" ");
      if (itemArtists.includes(lowerArtist)) {
        Logger.log(`Found artist match: ${item.name} by ${item.artists.map(a => a.name).join(", ")}`);
        return item.uri;
      }
    }
  }

  const bestMatch = items[0];
  Logger.log(`Closest match: ${bestMatch.name} by ${bestMatch.artists.map(a => a.name).join(", ")}`);
  return bestMatch.uri;
}

/**
 * Add a single track to the Spotify playlist using its URI.
 */function addTrackToPlaylist(trackUri, token) {
  const url = "https://api.spotify.com/v1/playlists/" + PLAYLIST_ID + "/tracks";
  UrlFetchApp.fetch(url, {
    method: "POST",
    headers: { 
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({ uris: [trackUri] })
  });
  Logger.log("Added track: " + trackUri);
}

/**
 * Add multiple songs from a multiline input to the playlist.
 */
function addMultipleSongsToPlaylist(rawInput) {
  const songs = rawInput.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);

  const token = getSpotifyAccessToken();

  for (const songEntry of songs) {
    Logger.log("Processing: " + songEntry);
    const trackUri = searchSpotifyTrack(songEntry, token);

    if (!trackUri) {
      Logger.log("No track found for: " + songEntry);
      continue;
    }
    addTrackToPlaylist(trackUri, token);
    Logger.log("Added track for: " + songEntry);
  }
}

/**
 * Add songs from the latest Google Sheets row to the playlist.
 */
function addLatestSongsToPlaylist() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form Responses 1");
  const lastRow = sheet.getLastRow();
  const rawInput = sheet.getRange(lastRow, 2).getValue(); // Column B - multiline song entries

  addMultipleSongsToPlaylist(rawInput);
}