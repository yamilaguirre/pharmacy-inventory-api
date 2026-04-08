import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('signed-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('register', () => {
    it('should create a user and return a token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        role: Role.CASHIER,
      });

      const result = await service.register({
        email: 'a@b.com',
        password: 'password123',
      });

      expect(result).toEqual({ access_token: 'signed-token' });
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'a@b.com',
        role: Role.CASHIER,
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ email: 'a@b.com', password: 'pass1234' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should assign the provided role when given', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u2',
        email: 'admin@b.com',
        role: Role.ADMIN,
      });

      await service.register({
        email: 'admin@b.com',
        password: 'pass1234',
        role: Role.ADMIN,
      });

      const calls = mockPrisma.user.create.mock.calls as Array<
        [{ data: { role: Role } }]
      >;
      expect(calls[0][0].data.role).toBe(Role.ADMIN);
    });
  });

  describe('login', () => {
    it('should return a token for valid credentials', async () => {
      const hashed = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: hashed,
        role: Role.CASHIER,
      });

      const result = await service.login({
        email: 'a@b.com',
        password: 'password123',
      });

      expect(result).toEqual({ access_token: 'signed-token' });
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'x@y.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: hashed,
        role: Role.CASHIER,
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
