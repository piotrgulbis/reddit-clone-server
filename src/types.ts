import { Request, Response } from 'express';
import { Session, SessionData } from 'express-session';
import { Redis } from 'ioredis';

import { Connection, EntityManager, IDatabaseDriver } from '@mikro-orm/core';

declare module 'express-session' {
  interface Session {
    // declare a user object to save more data than just an ID.
    // user: { [key: string]: any };
    userId: number;
  }
};

export type MyContext = {
  em: EntityManager<IDatabaseDriver<Connection>>
  redis: Redis,
  req: Request & { session: Session & Partial<SessionData> }
  res: Response
};
