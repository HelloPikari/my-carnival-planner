export async function GET() {
  const issuer = process.env.OAUTH_ISSUER ?? "https://my-carnival-planner.vercel.app";

  // authorization_servers points at our own proxy (not WorkOS directly),
  // so clients discover /api/oauth/* endpoints and route through us.
  return Response.json({ resource: issuer, authorization_servers: [issuer] });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
