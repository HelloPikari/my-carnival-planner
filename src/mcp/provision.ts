import { db } from "@/src/db/index.js";
import { users } from "@/src/db/schema/users.js";
import { eq } from "drizzle-orm";

interface WorkosUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export async function findOrProvisionUser(workosUser: WorkosUser) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.workosId, workosUser.id))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const displayName =
    [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") ||
    workosUser.email.split("@")[0];

  const [created] = await db
    .insert(users)
    .values({
      workosId: workosUser.id,
      email: workosUser.email,
      displayName,
      subscriptionPlan: "free",
      subscriptionStatus: "active",
    })
    .returning();

  return created;
}
