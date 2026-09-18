import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Role } from '../../generated/prisma/client.js';
import { ProductsService } from './products.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CreateProductDto, UpdateProductDto, CreateProductFamilyDto, UpdateProductFamilyDto } from './dto/product.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('brandId') brandId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('familyId') familyId?: string,
  ) {
    const canViewCost = req.user.role === Role.ADMIN || !!req.user.canViewCost;
    return this.products.findAll({ search, brandId, categoryId, familyId, canViewCost });
  }

  @Get('families')
  families() {
    return this.products.families();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('families')
  createFamily(@Body() body: CreateProductFamilyDto) {
    return this.products.createFamily(body);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('families/:id')
  updateFamily(@Param('id') id: string, @Body() body: UpdateProductFamilyDto) {
    return this.products.updateFamily(id, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const canViewCost = req.user.role === Role.ADMIN || !!req.user.canViewCost;
    return this.products.findOne(id, canViewCost);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() body: CreateProductDto, @Req() req: any) {
    return this.products.create(body, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() body: UpdateProductDto) {
    return this.products.update(id, req.user.sub, body);
  }

  @Get(':id/price-history')
  priceHistory(@Param('id') id: string) {
    return this.products.priceHistory(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/products',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const ok = /image\/(jpeg|png|webp)/.test(file.mimetype);
        cb(ok ? null : new Error('Only JPEG, PNG or WEBP images are allowed'), ok);
      },
    }),
  )
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.products.setImage(id, `/uploads/products/${file.filename}`);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.products.remove(id, req.user.sub);
  }
}