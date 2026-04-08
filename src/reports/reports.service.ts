import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface LowStockRow {
  stock_id: string;
  quantity: number;
  min_stock: number;
  product_id: string;
  product_name: string;
  sku: string;
  price: string;
  category_id: string;
  category_name: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all active products whose current stock is at or below
   * their configured minimum stock threshold.
   * Prisma cannot compare two columns in the same row using its standard
   * where clause, so we use a raw SQL query here.
   */
  async lowStock() {
    const rows = await this.prisma.$queryRaw<LowStockRow[]>(Prisma.sql`
      SELECT
        s.id          AS stock_id,
        s.quantity,
        s.min_stock,
        p.id          AS product_id,
        p.name        AS product_name,
        p.sku,
        p.price,
        c.id          AS category_id,
        c.name        AS category_name
      FROM stock s
      JOIN products p ON p.id = s.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE p.active = true
        AND s.quantity <= s.min_stock
      ORDER BY s.quantity ASC
    `);

    return rows.map((r) => ({
      stockId: r.stock_id,
      quantity: Number(r.quantity),
      minStock: Number(r.min_stock),
      product: {
        id: r.product_id,
        name: r.product_name,
        sku: r.sku,
        price: r.price,
        category: { id: r.category_id, name: r.category_name },
      },
    }));
  }

  /**
   * Returns all active products whose expiry date falls within the next
   * `days` days (default 30). Products with no expiry date are excluded.
   */
  expiringSoon(days = 30) {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + days);

    return this.prisma.product.findMany({
      where: {
        active: true,
        expiresAt: { gte: from, lte: to },
      },
      include: {
        category: true,
        stock: { select: { quantity: true, minStock: true } },
      },
      orderBy: { expiresAt: 'asc' },
    });
  }
}
