// /api/exchange-token.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, codeVerifier } = req.body;

  //const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientId = "7f10b028ac7543d8af89eda124704d3f";
  const redirectUri = "http://localhost:3000/callback";
  console.log("clientId:", clientId);
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });
  console.log("Code:", code);
  console.log("Code Verifier:", codeVerifier);
  console.log("Redirect URI:", redirectUri);

  const data = await response.json();

  if (data.error) {
    return res.status(400).json({ error: data.error_description });
  }

  return res.status(200).json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}
