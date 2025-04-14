export async function getSpotifyUserProfile() {
  const accessToken = localStorage.getItem("spotify_access_token");

  if (!accessToken) {
    console.error("No access token found");
    return null;
  }

  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    console.error("Failed to fetch profile", await res.json());
    return null;
  }

  const data = await res.json();
  return data;
}
