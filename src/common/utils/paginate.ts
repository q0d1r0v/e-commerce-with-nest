import { PrismaService } from '@/src/prisma.service';
import { PaginatedResult } from '../interfaces/paginated-result.interface';

interface PaginateOptions<M, W, O, S> {
  model: (prisma: PrismaService) => {
    findMany: (args: {
      where?: W;
      skip?: number;
      take?: number;
      orderBy?: O;
      select?: S;
    }) => Promise<M[]>;
    count: (args: { where?: W }) => Promise<number>;
  };
  where?: W;
  orderBy?: O;
  select?: S;
  page?: number;
  limit?: number;
}

export async function paginate<
  Model,
  Where extends Record<string, any> = Record<string, any>,
  OrderBy extends Record<string, any> = Record<string, any>,
  Select extends Record<string, any> = Record<string, any>,
>(
  prisma: PrismaService,
  options: PaginateOptions<Model, Where, OrderBy, Select>,
): Promise<PaginatedResult<Model>> {
  const { model, where, orderBy, select, page = 1, limit = 15 } = options;
  const skip = (page - 1) * limit;

  const prismaModel = model(prisma);

  const [data, total] = await Promise.all([
    prismaModel.findMany({
      where,
      skip,
      take: limit,
      ...(orderBy ? { orderBy } : {}),
      ...(select ? { select } : {}),
    }),
    prismaModel.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
