import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";
import { Public } from "../../common/decorators/public.decorator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Health check" })
  async check() {
    const checks: { name: string; status: string }[] = [];

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.push({ name: "database", status: "up" });
    } catch {
      checks.push({ name: "database", status: "down" });
    }

    const memory = process.memoryUsage();
    checks.push({ name: "memory", status: "up" });

    const healthy = checks.every((c) => c.status === "up");
    return {
      status: healthy ? "ok" : "degraded",
      checks,
      memoryMb: Math.round(memory.rss / 1024 / 1024),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}