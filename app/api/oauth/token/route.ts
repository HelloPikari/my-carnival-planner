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
  if (!res.ok) {
    const upstream = await res.text();
    console.error("WorkOS authenticate error:", upstream);
    throw new Error("Authentication failed");
  }
  return res.json();
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  let params: URLSearchParams;
  try {
    const text = await req.text();
    params = contentType.includes("application/json")
      ? new URLSearchParams(JSON.parse(text) as Record<string, string>)
      : new URLSearchParams(text);
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: CORS_HEADERS });
  }

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
      return Response.json({ error: "unsupported_grant_type" }, { status: 400, headers: CORS_HEADERS });
    }

    return Response.json(token, { headers: CORS_HEADERS });
  } catch (err) {
    return Response.json(
      { error: "server_error", error_description: (err as Error).message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
