import { handleAuth } from "@workos-inc/authkit-nextjs";
import { findOrProvisionUser } from "@/src/mcp/provision.js";

export const GET = handleAuth({
  onSuccess: async ({ user }) => {
    try {
      await findOrProvisionUser({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (err) {
      // Log but don't re-throw — a DB failure must not block the auth flow
      console.error("[provision] Failed to create user record:", err);
    }
  },
});
