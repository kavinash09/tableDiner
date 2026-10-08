// Base Models matching Prisma types
export interface Tenant {
  id: string;
  name: string;
  onboardingStatus: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Restaurant {
  id: string;
  tenantId: string;
  name: string;
  subscriptionTier: string;
  theme: string;
  qrTemplate: string;
  bannerUrl: string | null;
  businessDayCutoffHour: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: string;
  name: string;
  qrCode: string;
  restaurantId: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  restaurantId: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryId: string | null;
  restaurantId: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  tenantId: string;
  restaurantId: string;
  tableId: string;
  status: 'OPEN' | 'CLOSED' | 'REOPENED' | 'FINALIZED';
  businessDate: string | null;
  guestCount: number;
  
  subtotal: number | null;
  taxAmount: number | null;
  discountAmount: number | null;
  tipAmount: number | null;
  refundedAmount: number | null;
  totalAmount: number | null;
  
  closedAt: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  tenantId: string;
  sessionId: string;
  status: 'RECEIVED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED' | 'REJECTED';
  businessDate: string | null;
  
  acceptedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  tenantId: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  notes?: string | null;
  unitPrice: number;
  lineTotal: number;
  
  isVoided: boolean;
  voidReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  sessionId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: number;
  providerId: string | null;
  method: string | null;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------
// Analytics & Metrics API Contracts (Based on ANALYTICS_SPEC.md v1)
// ----------------------------------------------------------------------

// 1. Restaurant Owner - Dashboard Metrics
export interface DailyFinancialMetrics {
  grossRevenue: number;
  netRevenue: number;
  totalDiscounts: number;
  totalTips: number;
  refundedRevenue: number;
  avgTicketSize: number;
}

export interface DailyOrderMetrics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  cancellationRate: number; // decimal (e.g. 0.05 for 5%)
}

export interface DailyUtilizationMetrics {
  coversServed: number;
  avgPartySize: number;
  revenuePerCover: number;
  occupancyPercent: number; // decimal
  avgTableTurnTimeMinutes: number;
}

export interface DailySlaMetrics {
  avgKitchenPrepTimeMinutes: number;
  avgServiceTimeMinutes: number;
  avgFulfillmentTimeMinutes: number;
}

export interface RestaurantDashboardResponse {
  businessDate: string;
  financials: DailyFinancialMetrics;
  orders: DailyOrderMetrics;
  utilization: DailyUtilizationMetrics;
  slas: DailySlaMetrics;
}

// 2. Restaurant Owner - Menu Insights
export interface MenuItemInsight {
  menuItemId: string;
  name: string;
  quantitySold: number;
  revenueGenerated: number;
}

export interface RestaurantInsightsResponse {
  businessDate: string;
  topSellers: MenuItemInsight[];
  bottomSellers: MenuItemInsight[];
}

// 3. Restaurant Owner - End of Day Audit (EOD)
export interface EodSessionRecord {
  sessionId: string;
  tableName: string;
  guestCount: number;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  tipAmount: number;
  netAmount: number;
  paymentMethods: string[];
  closedAt: string;
  status: string; 
}

export interface RestaurantEodReportResponse {
  businessDate: string;
  financialSummary: DailyFinancialMetrics;
  sessions: EodSessionRecord[];
}

// 4. Platform Admin - Dashboard Metrics
export interface PlatformFinancialMetrics {
  mrr: number; 
  arr: number; 
  newMrr: number;
  churnedMrr: number;
  churnRate: number; // decimal
}

export interface PlatformGmvMetrics {
  totalGmv: number;
  ordersProcessed: number;
  sessionsProcessed: number;
  avgOrderValue: number;
}

export interface TenantFunnelMetrics {
  leadCount: number;
  trialCount: number;
  activeCount: number;
  suspendedCount: number;
  decommissionedCount: number;
}

export interface PlatformDashboardResponse {
  reportDate: string; 
  financials: PlatformFinancialMetrics;
  gmv: PlatformGmvMetrics;
  funnel: TenantFunnelMetrics;
}

// ----------------------------------------------------------------------
// Standard API Response Types
// ----------------------------------------------------------------------

export interface HealthResponse {
  status: string;
}

export interface TableDetailsResponse {
  table: { id: string; name: string };
  restaurant: { id: string; name: string; theme: string; bannerUrl: string | null };
  session: Session | null;
  menu: {
    categories: (MenuCategory & { items: MenuItem[] })[];
    uncategorized: MenuItem[];
  };
}

export interface PlaceOrderResponse {
  success: boolean;
  order: Order & { items: OrderItem[] };
}

export interface BillResponse {
  sessionId: string;
  itemized: {
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
  }[];
  totalAmount: number;
}

export interface PayResponse {
  success: boolean;
  message: string;
}

export type KitchenOrdersResponse = (Order & {
  items: (OrderItem & { menuItem: MenuItem })[];
  session: Session & { table: Table };
})[];

export type UpdateOrderResponse = Order;

export type AdminRestaurantsResponse = (Tenant & {
  restaurants: (Restaurant & { tables: Table[] })[];
})[];

export type CreateRestaurantResponse = Tenant & {
  restaurants: (Restaurant & { tables: Table[] })[];
};

export interface ErrorResponse {
  error: string;
}
