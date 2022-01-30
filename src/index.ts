import 'reflect-metadata';

import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import { ApolloServer } from 'apollo-server-express';
import connectRedis from 'connect-redis';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import Redis from 'ioredis';
import { buildSchema } from 'type-graphql';

import { MikroORM } from '@mikro-orm/core';

import { __prod__, COOKIE_NAME } from './constants';
import config from './mikro-orm.config';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';
import { MyContext } from './types';

const main = async () => {
  const orm = await MikroORM.init(config);
  await orm.getMigrator().up();

  const app = express();

  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })
  );

  // redis should come before apolloServer because
  // we are using redis inside our apolloServer.
  const RedisStore = connectRedis(session);
  const redis = new Redis('redis://127.0.0.1:6379');

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        ttl: 86400, // default
        disableTouch: true, // reduces requests to redis, session stays in redis indefinitely
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true,
        sameSite: 'lax', // csrf protection
        secure: __prod__, // cookie only works in https in production
      },
      saveUninitialized: false,
      secret: 'ewifhwewefew',
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ em: orm.em, req, res, redis }),
    plugins: [
      ApolloServerPluginLandingPageGraphQLPlayground({
        // options
      })
    ]
  });

  await apolloServer.start();
  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.listen(4000, () => {
    console.log('server started on localhost:4000');
  });
};

main().catch(err => {
  console.error(err);
});
