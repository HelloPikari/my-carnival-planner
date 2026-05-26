import { withAuth, signOut } from "@workos-inc/authkit-nextjs";

export default async function HomePage() {
  const { user } = await withAuth();

  async function handleSignOut() {
    "use server";
    await signOut();
  }

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
      <form action={handleSignOut}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
