import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType, MovementType, SaleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSaleDto, cashierId: string) {
    // 1. Resolve or create the customer
    const customer = await this.prisma.customer.upsert({
      where: {
        documentType_documentNumber: {
          documentType: dto.documentType,
          documentNumber: dto.documentNumber,
        },
      },
      update: { name: dto.customerName, email: dto.customerEmail },
      create: {
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        name: dto.customerName,
        email: dto.customerEmail,
      },
    });

    // 2. Fetch all products involved in the sale
    const productIds = dto.lines.map((l) => l.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      include: { stock: true },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found or inactive');
    }

    // 3. Validate stock and prescription requirements
    let requiresPrescription = false;

    for (const line of dto.lines) {
      const product = products.find((p) => p.id === line.productId)!;
      const available = product.stock?.quantity ?? 0;

      if (available < line.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${available}, requested: ${line.quantity}`,
        );
      }

      if (product.requiresPrescription) requiresPrescription = true;
    }

    if (requiresPrescription && !dto.prescriptionRef) {
      throw new BadRequestException(
        'A prescription reference is required for one or more products in this sale',
      );
    }

    // 4. Calculate line subtotals and total
    const lineData = dto.lines.map((line) => {
      const product = products.find((p) => p.id === line.productId)!;
      const unitPrice = Number(product.price);
      return {
        productId: line.productId,
        quantity: line.quantity,
        unitPrice,
        subtotal: unitPrice * line.quantity,
      };
    });

    const totalAmount = lineData.reduce((sum, l) => sum + l.subtotal, 0);

    // 5. Create sale + lines + stock movements in a single transaction
    const sale = await this.prisma.$transaction(async (tx) => {
      const createdSale = await tx.sale.create({
        data: {
          customerId: customer.id,
          cashierId,
          status: SaleStatus.COMPLETED,
          prescriptionRef: dto.prescriptionRef,
          totalAmount,
          lines: {
            create: lineData,
          },
        },
        include: {
          lines: { include: { product: true } },
          customer: true,
          cashier: { select: { id: true, email: true, role: true } },
        },
      });

      // Create OUT stock movements and update stock for each line
      for (const line of lineData) {
        const stock = products.find((p) => p.id === line.productId)!.stock;

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            type: MovementType.OUT,
            quantity: line.quantity,
            reason: `Sale #${createdSale.id.slice(0, 8)}`,
            createdById: cashierId,
          },
        });

        if (stock) {
          await tx.stock.update({
            where: { productId: line.productId },
            data: { quantity: { decrement: line.quantity } },
          });
        }
      }

      return createdSale;
    });

    return sale;
  }

  findAll() {
    return this.prisma.sale.findMany({
      include: {
        customer: true,
        cashier: { select: { id: true, email: true, role: true } },
        lines: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        cashier: { select: { id: true, email: true, role: true } },
        lines: { include: { product: true } },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  async cancel(id: string, adminId: string) {
    const sale = await this.findOne(id);

    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('Sale is already cancelled');
    }

    // Restore stock for each line in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id },
        data: { status: SaleStatus.CANCELLED },
      });

      for (const line of sale.lines) {
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            type: MovementType.IN,
            quantity: line.quantity,
            reason: `Cancellation of Sale #${id.slice(0, 8)}`,
            createdById: adminId,
          },
        });

        await tx.stock.upsert({
          where: { productId: line.productId },
          update: { quantity: { increment: line.quantity } },
          create: { productId: line.productId, quantity: line.quantity },
        });
      }
    });

    return this.findOne(id);
  }
}
