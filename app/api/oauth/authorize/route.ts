export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const target = new URL(
    process.env.WORKOS_AUTHORIZATION_ENDPOINT ??
      "https://api.workos.com/user_management/authorize"
  );

  for (const [key, value] of incoming.searchParams) {
    target.searchParams.set(key, value);
  }
  target.searchParams.set("provider", "authkit");

  return Response.redirect(target.toString(), 302);
}
