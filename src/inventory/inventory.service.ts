import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Stock ──────────────────────────────────────────────────

  findAllStock() {
    return this.prisma.stock.findMany({
      include: {
        product: { select: { id: true, name: true, sku: true, active: true } },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async findStockByProduct(productId: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { productId },
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    });
    if (!stock)
      throw new NotFoundException('Stock record not found for this product');
    return stock;
  }

  // ── Movements ─────────────────────────────────────────────

  findAllMovements() {
    return this.prisma.stockMovement.findMany({
      include: {
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMovement(dto: CreateMovementDto, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product || !product.active) {
      throw new NotFoundException('Product not found or inactive');
    }

    // Get or create the stock record for this product
    let stock = await this.prisma.stock.findUnique({
      where: { productId: dto.productId },
    });
    if (!stock) {
      stock = await this.prisma.stock.create({
        data: { productId: dto.productId, quantity: 0 },
      });
    }

    const newQuantity = this.calculateNewQuantity(
      stock.quantity,
      dto.type,
      dto.quantity,
    );

    // Use a transaction: both the movement record and stock update must succeed together
    const [movement] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          productId: dto.productId,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          createdById: userId,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          createdBy: { select: { id: true, email: true, role: true } },
        },
      }),
      this.prisma.stock.update({
        where: { productId: dto.productId },
        data: { quantity: newQuantity },
      }),
    ]);

    return movement;
  }

  private calculateNewQuantity(
    current: number,
    type: MovementType,
    quantity: number,
  ): number {
    switch (type) {
      case MovementType.IN:
        return current + quantity;
      case MovementType.OUT:
        if (current < quantity) {
          throw new BadRequestException(
            `Insufficient stock. Available: ${current}, requested: ${quantity}`,
          );
        }
        return current - quantity;
      case MovementType.ADJUSTMENT:
        return quantity;
    }
  }
}
