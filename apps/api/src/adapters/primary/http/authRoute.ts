import { Auth } from "@auth/core";
import CredentialsProvider from "@auth/core/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from '@tablediner/db';
import bcrypt from 'bcryptjs';
import type { FastifyRequest, FastifyReply } from 'fastify';

const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(credentials.password as string, user.password);
        if (!isValid) return null;

        return user;
      }
    })
  ],
  session: { strategy: "jwt" as const },
  secret: process.env.AUTH_SECRET || "super-secret-key-for-mvp-only",
  trustHost: true
};

export async function authHandler(request: FastifyRequest, reply: FastifyReply) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v));
    } else if (value) {
      headers.append(key, value as string);
    }
  }

  let body = undefined;
  if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
    body = JSON.stringify(request.body);
  }

  const req = new Request(url, {
    method: request.method,
    headers,
    body
  });

  const response = await Auth(req, authConfig);

  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });

  reply.status(response.status);
  const responseBody = await response.text();
  return reply.send(responseBody);
}
