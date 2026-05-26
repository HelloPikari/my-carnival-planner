import { withAuth, getSignInUrl } from "@workos-inc/authkit-nextjs";

export default async function HomePage() {
  const { user } = await withAuth();

  if (!user) {
    const signInUrl = await getSignInUrl();
    return (
      <main>
        <h1>My Carnival Planner</h1>
        <a href={signInUrl}>Sign in</a>
      </main>
    );
  }

  return (
    <main>
      <h1>My Carnival Planner</h1>
      <p>Welcome, {user.email}</p>
    </main>
  );
}
