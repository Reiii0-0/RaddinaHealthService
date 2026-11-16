import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthUserDto } from '@shared/api-contracts';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common';
import { UpdateRoleSipaDto } from './dto/update-role-sipa.dto';
import { UsersService } from './users.service';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('OWNER', 'PHARMACIST')
  async findAll(): Promise<AuthUserDto[]> {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  @Roles('OWNER')
  async updateRoleAndSipa(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleSipaDto,
  ): Promise<AuthUserDto> {
    return this.usersService.updateRoleAndSipa(id, dto);
  }
}
