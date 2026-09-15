import { PrismaClient } from "@prisma/client";
import { seedWorld } from "../lib/server/seedWorld";

const prisma = new PrismaClient();

seedWorld(prisma)
  .then((summary) => {
    console.log("Seed complete:", summary);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
