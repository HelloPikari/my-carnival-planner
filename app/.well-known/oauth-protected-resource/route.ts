export async function GET() {
  const resource = process.env.OAUTH_ISSUER ?? "https://my-carnival-planner.vercel.app";
  const authServer = process.env.WORKOS_ISSUER ?? "https://api.workos.com";

  return Response.json({ resource, authorization_servers: [authServer] });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
