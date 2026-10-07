import { z } from 'zod';

export const PlaceOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1, 'menuItemId is required'),
        quantity: z.number().int().min(1, 'quantity must be at least 1'),
        notes: z.string().optional(),
      })
    )
    .min(1, 'Order must contain at least one item'),
});

export type PlaceOrderPayload = z.infer<typeof PlaceOrderSchema>;

export const PaySchema = z.object({
  amount: z.number().min(0, 'Valid amount is required'),
});

export type PayPayload = z.infer<typeof PaySchema>;

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'PREPARING', 'READY', 'SERVED'], {
    errorMap: () => ({ message: 'Status must be one of: RECEIVED, PREPARING, READY, SERVED' }),
  }),
});

export type UpdateOrderStatusPayload = z.infer<typeof UpdateOrderStatusSchema>;

export const CreateRestaurantSchema = z.object({
  tenantName: z.string().min(1, 'tenantName is required'),
  restaurantName: z.string().min(1, 'restaurantName is required'),
  tablesCount: z.number().int().min(1, 'tablesCount must be at least 1'),
});

export type CreateRestaurantPayload = z.infer<typeof CreateRestaurantSchema>;

export const UpdateRestaurantSettingsSchema = z.object({
  theme: z.enum(['FOREST', 'MODERN_ZINC', 'CLASSIC_OCEAN']).optional(),
  qrTemplate: z.enum(['MINIMAL', 'PLAYFUL', 'ELEGANT']).optional(),
});

export type UpdateRestaurantSettingsPayload = z.infer<typeof UpdateRestaurantSettingsSchema>;
