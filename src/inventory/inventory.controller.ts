import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateMovementDto } from './dto/create-movement.dto';
import { InventoryService } from './inventory.service';

type RequestWithUser = Express.Request & { user: AuthUser };

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('stock')
  findAllStock() {
    return this.inventory.findAllStock();
  }

  @Get('stock/:productId')
  findStock(@Param('productId') productId: string) {
    return this.inventory.findStockByProduct(productId);
  }

  @Get('movements')
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  findAllMovements() {
    return this.inventory.findAllMovements();
  }

  @Post('movements')
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  createMovement(@Body() dto: CreateMovementDto, @Req() req: RequestWithUser) {
    return this.inventory.createMovement(dto, req.user.id);
  }
}
