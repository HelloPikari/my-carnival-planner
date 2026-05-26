import { withAuth } from "@workos-inc/authkit-nextjs";

export default async function HomePage() {
  const { user } = await withAuth();

  if (!user) {
    return (
      <main>
        <h1>My Carnival Planner</h1>
        <a href="/api/auth/signin">Sign in</a>
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
