import { handleAuth } from "@workos-inc/authkit-nextjs";
import { findOrProvisionUser } from "@/src/mcp/provision";

export const GET = handleAuth({
  onSuccess: async ({ user }) => {
    await findOrProvisionUser({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  },
});
