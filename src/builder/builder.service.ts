import { uid } from 'uid';
import axios from 'axios';
import delay from 'delay';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { RedisService } from 'nestjs-redis';
import { RequestDto } from './dto/request.dto';
import { CommandDto } from './dto/command.dto';

@Injectable()
export class BuilderService {
  constructor(
    @Inject('RABBIT_SERVICE') private clientMQ: ClientProxy,
    private readonly redisService: RedisService,
  ) {
    this.redisClient = this.redisService.getClient();
  }
  private redisClient;

  emitRabbit(body: RequestDto) {
    const id = uid(16);
    body.commands.forEach((command) => {
      command.id = id;
      this.clientMQ.emit('request_created', command);
    });
    return id;
  }

  async checkRequest(id: string) {
    const data = await this.redisClient.lrange(id, 0, -1);
    return data.map((item) => JSON.parse(item));
  }

  async createRequest(command: CommandDto) {
    const { verb, url, params, id } = command;
    let urlReplacer: string;
    if (params) {
      urlReplacer = params.reduce((acc, current) => {
        for (const [key, value] of Object.entries(current)) {
          const regex = new RegExp(`\\b${key}\\b`, 'g');
          return (acc = acc.replace(regex, value as string));
        }
      }, url);
    } else {
      urlReplacer = url;
    }

    try {
      const result = await axios({
        method: verb,
        url: urlReplacer,
      });
      const response = {
        requestURL: result.config.url,
        response: result.data,
        status: result.status,
      };
      this.getMessageRedis(response, id);
    } catch (error) {
      command.count ? command.count-- : (command.count = 2);

      if (command.count === 0) {
        const response = {
          requestURL: error.config.url,
          status: 'Failed',
        };
        this.getMessageRedis(response, id);
      } else {
        this.clientMQ.emit('request_created', command);
      }
    }

    await delay(2000);
  }

  async getMessageRedis(response, id) {
    this.redisClient.rpush(id, JSON.stringify(response));
  }
}
