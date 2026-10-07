import { FastifyRequest } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from './config';

// Ensure s3 client is initialized if in production
let s3Client: any = null;
if (config.NODE_ENV === 'production') {
  const { S3Client } = require('@aws-sdk/client-s3');
  s3Client = new S3Client({
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID!,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY!
    }
  });
}

export async function processUpload(data: any): Promise<string> {
  const fileBuffer = await data.toBuffer();
  const ext = path.extname(data.filename) || '.jpg';
  const filename = `${randomUUID()}${ext}`;

  if (config.NODE_ENV === 'production') {
    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET!,
      Key: filename,
      Body: fileBuffer,
      ContentType: data.mimetype
    }));
    return `https://${config.AWS_S3_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${filename}`;
  } else {
    // Save to local disk
    const uploadPath = path.join(process.cwd(), 'uploads', filename);
    await fs.writeFile(uploadPath, fileBuffer);
    
    // Determine host for returning URL
    const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
    return `${API_URL}/uploads/${filename}`;
  }
}

