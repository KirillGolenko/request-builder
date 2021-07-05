import { Method } from 'axios';

export class CommandDto {
  verb: Method;

  url: string;

  params: any[];

  id: string;

  count: number;
}
