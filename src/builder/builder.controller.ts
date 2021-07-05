import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { BuilderService } from './builder.service';
import { CommandDto } from './dto/command.dto';
import { RequestDto } from './dto/request.dto';

@Controller('builder')
export class BuilderController {
  constructor(private readonly builderService: BuilderService) {}

  @EventPattern('request_created')
  async handleUserCreated(
    @Payload() data: CommandDto,
    @Ctx() context: RmqContext,
  ) {
    await this.builderService.createRequest(data);

    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  @Post('/create')
  createRequest(@Body() body: RequestDto) {
    return this.builderService.emitRabbit(body);
  }

  @Get('/:id')
  checkRequest(@Param('id') id) {
    return this.builderService.checkRequest(id);
  }
}
