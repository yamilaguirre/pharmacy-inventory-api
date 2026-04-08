import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  describe('create', () => {
    const dto = {
      name: 'Aspirin',
      sku: 'ASP-001',
      price: '5.99',
      categoryId: 'cat-1',
    };

    it('should create a product when SKU is unique', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      const created = {
        id: 'p1',
        ...dto,
        category: { id: 'cat-1', name: 'Pain Relief' },
      };
      mockPrisma.product.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(mockPrisma.product.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if SKU already exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return only active products', async () => {
      const products = [{ id: 'p1', active: true }];
      mockPrisma.product.findMany.mockResolvedValue(products);

      const result = await service.findAll();

      expect(result).toEqual(products);
      const calls = mockPrisma.product.findMany.mock.calls as Array<
        [{ where: { active: boolean } }]
      >;
      expect(calls[0][0].where).toEqual({ active: true });
    });
  });

  describe('findOne', () => {
    it('should return the product when found', async () => {
      const product = { id: 'p1', name: 'X' };
      mockPrisma.product.findUnique.mockResolvedValue(product);

      expect(await service.findOne('p1')).toEqual(product);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove (soft delete)', () => {
    it('should set active=false instead of deleting', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', active: false });

      const result = await service.remove('p1');

      expect(result.active).toBe(false);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { active: false },
      });
    });
  });
});
