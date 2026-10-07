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

// Place an order for a table
app.post('/table/:qrCode/order', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  const { items } = request.body as { items: { menuItemId: string; quantity: number }[] };

  if (!items || items.length === 0) {
    return reply.status(400).send({ error: 'Order must contain items' });
  }

  const table = await prisma.table.findUnique({
    where: { qrCode },
    include: {
      sessions: { where: { status: 'ACTIVE' }, take: 1 }
    }
  });

  if (!table) return reply.status(404).send({ error: 'Table not found' });

  // Get or create active session
  let session = table.sessions[0];
  if (!session) {
    session = await prisma.session.create({
      data: {
        status: 'ACTIVE',
        restaurantId: table.restaurantId,
        tableId: table.id
      }
    });
  }

  // Create the order
  const order = await prisma.order.create({
    data: {
      sessionId: session.id,
      status: 'RECEIVED',
      items: {
        create: items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity
        }))
      }
    },
    include: { items: true }
  });

  return { success: true, order };
});

// --- BILLING & PAYMENTS ---
app.get('/table/:qrCode/bill', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };

  const table = await prisma.table.findUnique({
    where: { qrCode },
    include: {
      sessions: {
        where: { status: 'ACTIVE' },
        take: 1,
        include: {
          orders: {
            include: {
              items: {
                include: { menuItem: true }
              }
            }
          }
        }
      }
    }
  });

  if (!table || table.sessions.length === 0) {
    return reply.status(404).send({ error: 'No active session found.' });
  }

  const session = table.sessions[0];
  let totalAmount = 0;
  const itemized = [];

  for (const order of session.orders) {
    for (const item of order.items) {
      const lineTotal = item.menuItem.price * item.quantity;
      totalAmount += lineTotal;
      itemized.push({
        name: item.menuItem.name,
        quantity: item.quantity,
        price: item.menuItem.price,
        lineTotal
      });
    }
  }

  return { sessionId: session.id, itemized, totalAmount };
});

app.post('/table/:qrCode/pay', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };

  const table = await prisma.table.findUnique({
    where: { qrCode },
    include: {
      sessions: { where: { status: 'ACTIVE' }, take: 1 }
    }
  });

  if (!table || table.sessions.length === 0) {
    return reply.status(404).send({ error: 'No active session found.' });
  }

  const session = table.sessions[0];

  // Create payment record and close session in a transaction
  await prisma.$transaction([
    prisma.payment.create({
      data: {
        sessionId: session.id,
        status: 'COMPLETED',
        amount: (request.body as any).amount || 0
      }
    }),
    prisma.session.update({
      where: { id: session.id },
      data: { status: 'CLOSED' }
    })
  ]);

  return { success: true, message: 'Payment successful, session closed.' };
});

// --- KITCHEN DASHBOARD ROUTES ---
app.get('/kitchen/orders', async (request, reply) => {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['RECEIVED', 'PREPARING', 'READY'] }
    },
    include: {
      items: {
        include: { menuItem: true }
      },
      session: {
        include: { table: true }
      }
    },
    orderBy: { id: 'asc' } // Oldest orders first
  });
  return orders;
});

app.patch('/kitchen/orders/:orderId', async (request, reply) => {
  const { orderId } = request.params as { orderId: string };
  const { status } = request.body as { status: string };

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status }
  });
  return order;
});

// --- PLATFORM ADMIN ROUTES ---
app.get('/admin/restaurants', async (request, reply) => {
  const tenants = await prisma.tenant.findMany({
    include: {
      restaurants: {
        include: {
          tables: true
        }
      }
    }
  });
  return tenants;
});

app.post('/admin/restaurants', async (request, reply) => {
  const { tenantName, restaurantName, tablesCount } = request.body as { 
    tenantName: string; 
    restaurantName: string; 
    tablesCount: number 
  };

  if (!tenantName || !restaurantName || tablesCount === undefined) {
    return reply.status(400).send({ error: 'Missing required fields' });
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
      restaurants: {
        create: {
          name: restaurantName,
          tables: {
            create: Array.from({ length: tablesCount }).map((_, i) => ({
              name: `Table ${i + 1}`
            }))
          }
        }
      }
    },
    include: {
      restaurants: {
        include: { tables: true }
      }
    }
  });

  return tenant;
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
