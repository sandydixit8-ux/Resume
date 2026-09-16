import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { RbacService } from "./rbac.service";

class AssignRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  roleCode!: string;
}

@ApiTags("rbac")
@ApiBearerAuth()
@Controller("admin/rbac")
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get("roles")
  @RequirePermissions("role.view")
  @ApiOperation({ summary: "List roles with permissions" })
  listRoles() {
    return this.rbacService.listRoles();
  }

  @Get("permissions")
  @RequirePermissions("role.view")
  @ApiOperation({ summary: "List all permissions" })
  listPermissions() {
    return this.rbacService.listPermissions();
  }

  @Post("users/:userId/roles")
  @RequirePermissions("role.assign")
  @ApiOperation({ summary: "Assign a role to a user" })
  assignRole(@Param("userId") userId: string, @Body() dto: AssignRoleDto) {
    return this.rbacService.assignRole(userId, dto.roleCode);
  }

  @Delete("users/:userId/roles/:roleCode")
  @RequirePermissions("role.assign")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove a role from a user" })
  removeRole(@Param("userId") userId: string, @Param("roleCode") roleCode: string) {
    return this.rbacService.removeRole(userId, roleCode);
  }
}