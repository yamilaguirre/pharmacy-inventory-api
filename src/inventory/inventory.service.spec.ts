import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';

const movementResult = {
  id: 'm1',
  productId: 'p1',
  type: MovementType.IN,
  quantity: 10,
  reason: null,
  product: { id: 'p1', name: 'Aspirin', sku: 'ASP-001' },
  createdBy: { id: 'u1', email: 'test@test.com', role: 'ADMIN' },
};

const mockPrisma = {
  product: { findUnique: jest.fn() },
  stock: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  stockMovement: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(InventoryService);
  });

  describe('createMovement', () => {
    it('should add stock on IN movement', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        active: true,
      });
      mockPrisma.stock.findUnique.mockResolvedValue({
        productId: 'p1',
        quantity: 5,
      });
      mockPrisma.$transaction.mockResolvedValue([movementResult, {}]);

      const result = await service.createMovement(
        { productId: 'p1', type: MovementType.IN, quantity: 10 },
        'u1',
      );

      expect(result).toEqual(movementResult);
      const txCalls = mockPrisma.$transaction.mock.calls as Array<[unknown[]]>;
      expect(txCalls[0][0]).toHaveLength(2);
    });

    it('should throw NotFoundException if product is not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.createMovement(
          { productId: 'bad', type: MovementType.IN, quantity: 1 },
          'u1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on OUT when stock is insufficient', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        active: true,
      });
      mockPrisma.stock.findUnique.mockResolvedValue({
        productId: 'p1',
        quantity: 2,
      });

      await expect(
        service.createMovement(
          { productId: 'p1', type: MovementType.OUT, quantity: 10 },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set quantity directly on ADJUSTMENT', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        active: true,
      });
      mockPrisma.stock.findUnique.mockResolvedValue({
        productId: 'p1',
        quantity: 5,
      });
      mockPrisma.$transaction.mockResolvedValue([movementResult, {}]);

      await service.createMovement(
        { productId: 'p1', type: MovementType.ADJUSTMENT, quantity: 50 },
        'u1',
      );

      const updateCalls = mockPrisma.stock.update.mock.calls as Array<
        [{ data: { quantity: number } }]
      >;
      expect(updateCalls[0][0].data.quantity).toBe(50);
    });

    it('should create a stock record if none exists for the product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        active: true,
      });
      mockPrisma.stock.findUnique.mockResolvedValue(null);
      mockPrisma.stock.create.mockResolvedValue({
        productId: 'p1',
        quantity: 0,
      });
      mockPrisma.$transaction.mockResolvedValue([movementResult, {}]);

      await service.createMovement(
        { productId: 'p1', type: MovementType.IN, quantity: 10 },
        'u1',
      );

      expect(mockPrisma.stock.create).toHaveBeenCalledWith({
        data: { productId: 'p1', quantity: 0 },
      });
    });
  });
});
