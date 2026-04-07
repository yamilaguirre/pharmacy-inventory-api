import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

type RequestWithUser = Express.Request & { user: AuthUser };

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  @Roles(Role.CASHIER, Role.ADMIN)
  create(@Body() dto: CreateSaleDto, @Req() req: RequestWithUser) {
    return this.sales.create(dto, req.user.id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.PHARMACIST)
  findAll() {
    return this.sales.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.PHARMACIST, Role.CASHIER)
  findOne(@Param('id') id: string) {
    return this.sales.findOne(id);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN)
  cancel(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sales.cancel(id, req.user.id);
  }
}
