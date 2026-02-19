import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await hash("1f1femsk", 12);

  const admin = await prisma.user.upsert({
    where: { email: "gkozyris@i4ria.com" },
    update: {},
    create: {
      email: "gkozyris@i4ria.com",
      firstName: "Super",
      lastName: "Admin",
      hashedPassword,
      role: "SUPER_ADMIN",
    },
  });

  console.log("Seeded Super Admin:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
