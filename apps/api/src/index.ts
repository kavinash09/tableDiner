import { authHandler } from './adapters/primary/http/authRoute';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import formbody from '@fastify/formbody';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import {
  PlaceOrderSchema,
  PaySchema,
  UpdateOrderStatusSchema,
  CreateRestaurantSchema,
  UpdateRestaurantSettingsSchema
} from '@tablediner/shared-validation';
import { processUpload } from './uploadService';

// Import Adapters
import { 
  PrismaTableRepository, 
  PrismaSessionRepository, 
  PrismaOrderRepository, 
  PrismaPaymentRepository,
  PrismaRestaurantRepository,
  PrismaMenuItemRepository
} from './adapters/secondary/db/PrismaRepositories';

// Import Core Use Cases
import { PrismaClient } from "@tablediner/db";
const prismaClient = new PrismaClient();
import { PrismaRestaurantAnalyticsRepository } from "./adapters/secondary/db/PrismaRestaurantAnalyticsRepository";
import { GetRestaurantDashboardUseCase } from "./core/use-cases/GetRestaurantDashboardUseCase";
import { PrismaPlatformAnalyticsRepository } from "./adapters/secondary/db/PrismaPlatformAnalyticsRepository";
import { GetPlatformDashboardUseCase } from "./core/use-cases/GetPlatformDashboardUseCase";
import { AppUseCases } from './core/use-cases/AppUseCases';

// Ensure uploads dir exists for local dev
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const app = Fastify({ logger: true });

// Dependency Injection Setup
const tableRepo = new PrismaTableRepository();
const sessionRepo = new PrismaSessionRepository();
const orderRepo = new PrismaOrderRepository();
const paymentRepo = new PrismaPaymentRepository();
const restaurantRepo = new PrismaRestaurantRepository();
const menuItemRepo = new PrismaMenuItemRepository();

const analyticsRepo = new PrismaRestaurantAnalyticsRepository(prismaClient);
const getRestaurantDashboardUseCase = new GetRestaurantDashboardUseCase(analyticsRepo);
const platformAnalyticsRepo = new PrismaPlatformAnalyticsRepository(prismaClient);
const getPlatformDashboardUseCase = new GetPlatformDashboardUseCase(platformAnalyticsRepo);

const appUseCases = new AppUseCases(
  tableRepo,
  sessionRepo,
  orderRepo,
  paymentRepo,
  restaurantRepo,
  menuItemRepo
);

const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map(o => o.trim());

app.register(cors, {
  origin: (origin, cb) => {
    // Mobile apps or internal server calls might not have an origin
    if (!origin) {
      if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    }
    
    // Check against allowed origins from environment
    if (allowedOrigins.includes(origin) || config.NODE_ENV === 'development' || config.NODE_ENV === 'test') {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
});


app.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.register(formbody);

app.register(staticPlugin, {
  root: uploadsDir,
  prefix: '/uploads/',
});

app.get('/health', async () => ({ status: 'ok' }));

// Fetch table details, current session, and full menu by QR code
app.get('/table/:qrCode', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  try {
    const data = await appUseCases.getTableDetails(qrCode);
    if (!data) return reply.status(404).send({ error: 'Table not found or invalid QR code.' });
    return data;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch table data.' });
  }
});

// Place an order for a table
app.post('/table/:qrCode/order', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  const parsed = PlaceOrderSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0]?.message || 'Invalid input' });
  }
  const { items } = parsed.data;

  try {
    const order = await appUseCases.placeOrder(qrCode, items);
    return { success: true, order };
  } catch (err: any) {
    app.log.error(err);
    return reply.status(err.message === 'Table not found.' ? 404 : 500).send({ error: err.message || 'Failed to place order.' });
  }
});

// --- BILLING & PAYMENTS ---
app.get('/table/:qrCode/bill', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  try {
    const bill = await appUseCases.getBill(qrCode);
    return bill;
  } catch (err: any) {
    app.log.error(err);
    return reply.status(err.message === 'No active session found.' ? 404 : 500).send({ error: err.message || 'Failed to fetch bill.' });
  }
});

app.post('/table/:qrCode/pay', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  const parsed = PaySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0]?.message || 'Invalid input' });
  }
  const { amount } = parsed.data;

  try {
    await appUseCases.payBill(qrCode, amount);
    return { success: true, message: 'Payment successful. Session closed.' };
  } catch (err: any) {
    app.log.error(err);
    return reply.status(err.message === 'No active session found.' ? 404 : 500).send({ error: err.message || 'Payment failed. Please try again.' });
  }
});

// --- KITCHEN DASHBOARD ROUTES ---
app.get('/kitchen/orders', async (request, reply) => {
  try {
    const restaurant = await appUseCases.getCurrentRestaurant();
    if (!restaurant) return reply.status(404).send({ error: 'Restaurant not found' });
    const orders = await appUseCases.getKitchenOrders(restaurant.id);
    return orders;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch orders.' });
  }
});

app.patch('/kitchen/orders/:orderId', async (request, reply) => {
  const { orderId } = request.params as { orderId: string };
  const parsed = UpdateOrderStatusSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0]?.message || 'Invalid input' });
  }
  const { status } = parsed.data;

  try {
    const order = await appUseCases.updateOrderStatus(orderId, status);
    return order;
  } catch (err: any) {
    app.log.error(err);
    return reply.status(400).send({ error: err.message || 'Failed to update order status.' });
  }
});

// --- PLATFORM ADMIN ROUTES ---
app.get('/admin/restaurants', async (request, reply) => {
  try {
    const tenants = await appUseCases.getPlatformTenants();
    return tenants;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch tenants.' });
  }
});

app.post('/admin/restaurants', async (request, reply) => {
  const parsed = CreateRestaurantSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0]?.message || 'Invalid input' });
  }
  const { tenantName, restaurantName, tablesCount } = parsed.data;

  try {
    const tenant = await appUseCases.createPlatformTenant(tenantName, restaurantName, tablesCount);
    return tenant;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to create tenant.' });
  }
});

app.get('/restaurant/current', async (request, reply) => {
  try {
    const restaurant = await appUseCases.getCurrentRestaurant();
    return restaurant;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch restaurant' });
  }
});

app.patch('/restaurant/:id/settings', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const parseResult = UpdateRestaurantSettingsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { theme, qrTemplate } = parseResult.data;
    const restaurant = await appUseCases.updateRestaurantSettings(id, theme as string, qrTemplate as string);
    return restaurant;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to update settings.' });
  }
});

app.post('/restaurant/:id/banner', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const bannerUrl = await processUpload(data);
    await appUseCases.updateRestaurantBanner(id, bannerUrl);
    
    return { success: true, bannerUrl };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to upload banner' });
  }
});

app.post('/menu-item/:id/image', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const imageUrl = await processUpload(data);
    await appUseCases.updateMenuItemImage(id, imageUrl);
    
    return { success: true, imageUrl };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to upload image' });
  }
});

// --- MENU CRUD ROUTES ---
import { CreateCategorySchema, CreateMenuItemSchema, UpdateMenuItemSchema } from '@tablediner/shared-validation';

app.post('/restaurant/:id/categories', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = CreateCategorySchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0]?.message });
  
  try {
    const category = await appUseCases.createMenuCategory(id, parsed.data.name);
    return category;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to create category' });
  }
});

app.delete('/category/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    await appUseCases.deleteMenuCategory(id);
    return { success: true };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to delete category' });
  }
});

app.post('/restaurant/:id/items', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = CreateMenuItemSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0]?.message });
  
  try {
    const item = await appUseCases.createMenuItem(id, parsed.data);
    return item;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to create menu item' });
  }
});

app.patch('/menu-item/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = UpdateMenuItemSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0]?.message });
  
  try {
    const item = await appUseCases.updateMenuItem(id, parsed.data);
    return item;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to update menu item' });
  }
});

app.delete('/menu-item/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    await appUseCases.deleteMenuItem(id);
    return { success: true };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to delete menu item' });
  }
});


// --- AUTHENTICATION ROUTES (NextAuth / Auth.js) ---
app.all('/api/auth/*', async (request, reply) => {
  return authHandler(request, reply);
});

import { GetEODAuditReportUseCase } from './core/use-cases/GetEODAuditReportUseCase';

const getEODAuditReportUseCase = new GetEODAuditReportUseCase(analyticsRepo);

// --- ANALYTICS ROUTES ---
app.get("/api/v1/restaurants/:id/metrics/daily", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { date } = request.query as { date?: string };

  try {
    // If no date provided, use today's logical date based on current time (assumed UTC / server time)
    const targetDate = date || new Date().toISOString().split("T")[0];
    
    const dashboard = await getRestaurantDashboardUseCase.execute(id, targetDate);
    return dashboard;
  } catch (err: any) {
    app.log.error(err);
    return reply.status(500).send({ error: err.message || "Failed to fetch metrics" });
  }
});

app.get("/api/v1/restaurants/:id/audit/eod", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { date } = request.query as { date?: string };

  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const report = await getEODAuditReportUseCase.execute(id, targetDate);
    return report;
  } catch (err: any) {
    app.log.error(err);
    return reply.status(500).send({ error: err.message || "Failed to fetch EOD Audit Report" });
  }
});

import { CsvExportAdapter } from './adapters/secondary/csv/CsvExportAdapter';
const csvExportAdapter = new CsvExportAdapter();

app.get("/api/v1/restaurants/:id/audit/eod/export", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { date } = request.query as { date?: string };

  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const report = await getEODAuditReportUseCase.execute(id, targetDate);
    const csvContent = csvExportAdapter.generateEodCsv(report);
    
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="eod_audit_${id}_${targetDate}.csv"`);
    return reply.send(csvContent);
  } catch (err: any) {
    app.log.error(err);
    return reply.status(500).send({ error: err.message || "Failed to export EOD Audit Report" });
  }
});

app.get("/api/v1/platform/metrics", async (request, reply) => {
  const { date } = request.query as { date?: string };
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const dashboard = await getPlatformDashboardUseCase.execute(targetDate);
    return dashboard;
  } catch (err: any) {
    app.log.error(err);
    return reply.status(500).send({ error: err.message || "Failed to fetch platform metrics" });
  }
});


export { app };

const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`Server listening on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Only start the server if this file is executed directly (not when imported for tests)
if (require.main === module) {
  start();
}
