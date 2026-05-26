export async function POST(req: Request) {
  const clientId = process.env.WORKOS_CLIENT_ID;
  if (!clientId) {
    return Response.json(
      { error: "server_error", error_description: "Server misconfigured" },
      { status: 500 }
    );
  }

  const body = await req.json() as { redirect_uris?: string[] };
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

  // WorkOS enforces the redirect_uri allowlist on the authorize step,
  // so accepting arbitrary URIs here is safe in this proxy architecture.
  return Response.json(
    {
      client_id: clientId,
      client_secret_expires_at: 0,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201 }
  );
}
