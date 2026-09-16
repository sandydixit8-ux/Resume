import { Body, Controller, Get, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser as CurrentUserDecorator } from "../../common/decorators/current-user.decorator";
import { CurrentUser } from "@nexus/contracts";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { UsersService } from "./users.service";

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  phone?: string;
}

class ListUsersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get current user profile" })
  getMe(@CurrentUserDecorator() user: CurrentUser) {
    return user;
  }

  @Patch("me")
  @ApiOperation({ summary: "Update current user profile" })
  updateMe(@CurrentUserDecorator() user: CurrentUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get()
  @RequirePermissions("user.view")
  @ApiOperation({ summary: "List users (admin)" })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query, {
      role: query.role,
      status: query.status,
      query: query.q,
    });
  }
}