import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    console.log('Prisma connected to DB');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Prisma disconnected from DB');
  }
}
