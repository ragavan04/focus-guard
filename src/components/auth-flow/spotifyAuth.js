// Generate random code verifier
export function generateRandomString(length) {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

// SHA-256 hash function
export async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await window.crypto.subtle.digest("SHA-256", data);
}

// Convert to base64-url
export function base64encode(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Generate code challenge from code verifier
export async function generateCodeChallenge(codeVerifier) {
  const hashed = await sha256(codeVerifier);
  return base64encode(hashed);
}

// Redirect user to Spotify auth
export async function redirectToSpotifyLogin() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ||
    `${
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"
    }/callback`;

  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem("code_verifier", codeVerifier);

  const scope =
    "user-read-private user-read-email user-read-playback-state user-modify-playback-state streaming playlist-read-private playlist-read-collaborative";

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  }).toString();

  window.location.href = authUrl.toString();
}
