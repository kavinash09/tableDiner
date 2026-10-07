import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from '@tablediner/db';

const app = Fastify({ logger: true });

app.register(cors, {
  origin: '*', // For MVP/development, allow all origins
});

app.get('/health', async () => ({ status: 'ok' }));

// Fetch table details, current session, and full menu by QR code
app.get('/table/:qrCode', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };

  const table = await prisma.table.findUnique({
    where: { qrCode },
    include: {
      restaurant: {
        include: {
          menuCategories: {
            include: {
              items: true,
            },
          },
          menuItems: {
            where: { categoryId: null }, // Uncategorized items
          }
        },
      },
      sessions: {
        where: { status: 'ACTIVE' },
        take: 1,
      },
    },
  });

  if (!table) {
    return reply.status(404).send({ error: 'Table not found or invalid QR code.' });
  }

  return {
    table: {
      id: table.id,
      name: table.name,
    },
    restaurant: {
      id: table.restaurant.id,
      name: table.restaurant.name,
    },
    session: table.sessions[0] || null, // Active session if it exists
    menu: {
      categories: table.restaurant.menuCategories,
      uncategorized: table.restaurant.menuItems,
    },
  };
});

const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    app.log.info(`Server listening on port 3001`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
