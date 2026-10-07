import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env variables
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  
  // AWS Configuration - strictly required in production
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (!data.AWS_REGION) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'AWS_REGION is required in production' });
    if (!data.AWS_ACCESS_KEY_ID) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'AWS_ACCESS_KEY_ID is required in production' });
    if (!data.AWS_SECRET_ACCESS_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'AWS_SECRET_ACCESS_KEY is required in production' });
    if (!data.AWS_S3_BUCKET) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'AWS_S3_BUCKET is required in production' });
  }
});

const parseResult = EnvSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parseResult.error.format(), null, 2));
  process.exit(1);
}

export const config = parseResult.data;

