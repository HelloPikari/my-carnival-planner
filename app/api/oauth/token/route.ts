async function callWorkosAuthenticate(body: Record<string, string>) {
  const res = await fetch("https://api.workos.com/user_management/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.WORKOS_CLIENT_ID,
      client_secret: process.env.WORKOS_API_KEY,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`WorkOS authenticate failed: ${await res.text()}`);
  return res.json();
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const text = await req.text();
  const params = contentType.includes("application/json")
    ? new URLSearchParams(JSON.parse(text) as Record<string, string>)
    : new URLSearchParams(text);

  try {
    const grantType = params.get("grant_type");

    let token: unknown;
    if (grantType === "authorization_code") {
      token = await callWorkosAuthenticate({
        grant_type: "authorization_code",
        code: params.get("code") ?? "",
        redirect_uri: params.get("redirect_uri") ?? "",
        ...(params.get("code_verifier") ? { code_verifier: params.get("code_verifier")! } : {}),
      });
    } else if (grantType === "refresh_token") {
      token = await callWorkosAuthenticate({
        grant_type: "refresh_token",
        refresh_token: params.get("refresh_token") ?? "",
      });
    } else {
      return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
    }

    return Response.json(token);
  } catch (err) {
    return Response.json(
      { error: "server_error", error_description: (err as Error).message },
      { status: 500 }
    );
  }
}
