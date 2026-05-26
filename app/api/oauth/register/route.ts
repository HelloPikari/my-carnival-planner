export async function POST(req: Request) {
  const body = await req.json() as { redirect_uris?: string[] };
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

  return Response.json(
    {
      client_id: process.env.WORKOS_CLIENT_ID,
      client_secret_expires_at: 0,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201 }
  );
}
