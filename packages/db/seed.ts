import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Clear existing
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.table.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: { name: 'TableDiner Demo' }
  });

  const hashedPassword = await bcrypt.hash('password123', 10);
  await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@tablediner.com',
      password: hashedPassword,
      tenantId: tenant.id
    }
  });


  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'The Rusty Spoon',
      tenantId: tenant.id,
    }
  });

  await prisma.table.createMany({
    data: [
      { name: 'Table 1', qrCode: 'table-1', restaurantId: restaurant.id },
      { name: 'Table 2', qrCode: 'table-2', restaurantId: restaurant.id },
      { name: 'Table 3', qrCode: 'table-3', restaurantId: restaurant.id },
    ]
  });

  await prisma.menuCategory.create({
    data: {
      name: 'Starters',
      restaurantId: restaurant.id,
      items: {
        create: [
          { name: 'Garlic Bread', price: 149.99, description: 'Warm and crispy', restaurantId: restaurant.id },
          { name: 'Caesar Salad', price: 199.99, restaurantId: restaurant.id }
        ]
      }
    }
  });

  await prisma.menuCategory.create({
    data: {
      name: 'Mains',
      restaurantId: restaurant.id,
      items: {
        create: [
          { name: 'Truffle Pasta', price: 499.99, description: 'Rich mushroom sauce', restaurantId: restaurant.id },
          { name: 'Wagyu Burger', price: 599.99, description: 'With crispy fries', restaurantId: restaurant.id }
        ]
      }
    }
  });

  console.log('Database seeded successfully! Try scanning qrCode: "table-1"');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
