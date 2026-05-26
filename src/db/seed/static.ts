import { db } from "../index.js";
import { subscriptionPlans, planEntitlements, carnivals, carnivalSeasons, locations } from "../schema/index.js";

export async function seedStatic() {
  console.log("Seeding static data...");

  // Trinidad location (area type for the carnival)
  const [trinidadLocation] = await db
    .insert(locations)
    .values([
      {
        name: "Trinidad",
        city: "Port of Spain",
        country: "Trinidad and Tobago",
        latitude: "10.6596",
        longitude: "-61.5086",
        type: "area",
      },
    ])
    .returning();

  console.log(`  Created Trinidad location`);

  // Trinidad Carnival
  const [trinidadCarnival] = await db
    .insert(carnivals)
    .values([
      {
        name: "Trinidad Carnival",
        locationId: trinidadLocation.id,
        description: "The Greatest Show on Earth. Two days of masquerade bands parading through the streets of Port of Spain.",
      },
    ])
    .returning();

  console.log(`  Created Trinidad Carnival`);

  // 2025 and 2026 seasons
  await db.insert(carnivalSeasons).values([
    {
      carnivalId: trinidadCarnival.id,
      year: 2025,
      startDate: "2025-03-03",
      endDate: "2025-03-04",
      status: "archived",
    },
    {
      carnivalId: trinidadCarnival.id,
      year: 2026,
      startDate: "2026-02-16",
      endDate: "2026-02-17",
      status: "active",
    },
  ]);

  console.log(`  Created 2025 + 2026 carnival seasons`);

  // Subscription plans
  await db.insert(subscriptionPlans).values([
    { name: "Free", tier: "free", price: "0", billingInterval: "forever" },
    { name: "Basic", tier: "basic", price: "9.99", billingInterval: "monthly" },
    { name: "Premium", tier: "premium", price: "24.99", billingInterval: "monthly" },
  ]);

  console.log(`  Created subscription plans`);

  console.log("Static seed complete.");
}
