import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = [
    { email: "alice@example.com", displayName: "Alice", bio: "Runner and coffee fan", city: "Berlin", interests: "running,coffee,travel" },
    { email: "bob@example.com", displayName: "Bob", bio: "Guitarist and foodie", city: "Hamburg", interests: "music,food,hiking" },
    { email: "carol@example.com", displayName: "Carol", bio: "Designer and climber", city: "Munich", interests: "design,climbing,reading" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        displayName: u.displayName,
        profile: {
          upsert: {
            update: { bio: u.bio, city: u.city, interests: u.interests },
            create: { bio: u.bio, city: u.city, interests: u.interests },
          },
        },
      },
      create: {
        email: u.email,
        displayName: u.displayName,
        profile: { create: { bio: u.bio, city: u.city, interests: u.interests } },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
