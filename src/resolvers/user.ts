import 'reflect-metadata';

import argon2 from 'argon2';
import { Arg, Ctx, Field, Int, Mutation, ObjectType, Query, Resolver } from 'type-graphql';

import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from '../constants';
import { User } from '../entities/User';
import { MyContext } from '../types';
import { sendEmail } from '../utils/sendEmail';
import { validateRegister } from '../utils/validateRegister';
import { UsernamePasswordInput } from './UsernamePasswordInput';
import { v4 } from 'uuid';

@ObjectType()
class FieldError {
  @Field(() => String)
  field: string
  @Field(() => String)
  message: string
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[]
  @Field(() => User, { nullable: true })
  user?: User
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    if (!req.session.userId) {
      return null;
    }

    return User.findOne(req.session.userId);
  };

  @Query(() => [User])
  users(): Promise<User[]> {
    return User.find();
  };

  @Mutation(() => Number)
  async deleteUser(@Arg('id', () => Int) id: number): Promise<Number> {
    await User.delete(id);
    return id;
  };

  @Mutation(() => UserResponse)
  async register(
    @Arg('options', () => UsernamePasswordInput) options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const userExists = await User.findOne({ where: { username: options.username.toLowerCase() } });

    if (userExists) {
      return {
        errors: [{
          field: 'usernameOrEmail',
          message: 'The username already exists.',
        }]
      };
    }

    const errors = validateRegister(options);

    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);
    let user;

    try {
      user = await User.create({
        username: options.username.toLowerCase(),
        password: hashedPassword,
        email: options.email.toLowerCase(),
      }).save(); 
      // Example of using Query Builder
      // Add following Import:  import { getConnection } from 'typeorm';
      // const result = await getConnection()
      //   .createQueryBuilder()
      //   .insert()
      //   .into(User)
      //   .values({
      //     username: options.username.toLowerCase(),
      //     password: hashedPassword,
      //     email: options.email.toLowerCase(),
      //   })
      //   .returning('*')
      //   .execute();
      // user = result.raw[0];
    } catch (err) {
      return {
        errors: [{
          field: 'db',
          message: err.detail
        }]
      };
    }

    req.session.userId = user.id;

    return { user };
  };

  @Mutation(() => UserResponse)
  async login(
    @Arg('usernameOrEmail', () => String) usernameOrEmail: string,
    @Arg('password', () => String) password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes('@')
        ? { where: { email: usernameOrEmail.toLowerCase() } }
        : { where: { username: usernameOrEmail.toLowerCase() } }
    );

    // Piotr 15.01.2022: This is in my opinion not secure because you are giving a hint
    // to a attacker if that user exists. In my opinion the better way to do this is 
    // just to return a general error of username/password invalid for any
    // validation errors. This is purely here for the sake of following
    // the tutorial.
    // Piotr 20.01.2022: Changed to generic user message.
    if (!user) {
      return {
        errors: [{
          field: 'usernameOrEmail',
          message: 'That user does not exist.',
        }]
      };
    };

    const validPassword = await argon2.verify(user.password, password);

    if (!validPassword) {
      return {
        errors: [{
          field: 'password',
          message: 'The password is incorrect.',
        }]
      };
    }

    req.session.userId = user.id;

    return { user };
  };

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise(resolve => req.session.destroy(err => {
      res.clearCookie(COOKIE_NAME);
      if (err) {
        console.log(err);
        resolve(false);
        return;
      }

      resolve(true);
    }));
  };

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { redis }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 5) {
      return {
        errors: [
          {
            field: 'newPassword',
            message: 'The password must be at least six characters long.',
          },
        ]
      };
    }

    const key = FORGOT_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);

    if (!userId) {
      return {
        errors: [
          {
            field: 'token',
            message: 'The token has expired.',
          },
        ]
      };
    }

    const id = parseInt(userId);
    const user = await User.findOne(id);

    if (!user) {
      return {
        errors: [
          {
            field: 'token',
            message: 'User no longer exists.',
          },
        ]
      };
    }

    const hashedPassword = await argon2.hash(newPassword);
    user.password = hashedPassword;
    await User.update(id, { password: hashedPassword });

    await redis.del(key);

    // optional log in user after change password
    // note: add req to context above
    // req.session.userId = user.id;

    return { user };
  };


  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg('email') email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Email not found, return true and do nothing so that the user does not know that 
      // the email was not found in the db to stop phishing.
      return true;
    }

    const token = v4();

    await redis.set(
      FORGOT_PASSWORD_PREFIX + token,
      user.id,
      'ex',
      1000 * 60 * 60 * 24 * 3
    ); // three days

    await sendEmail(email,
      `<a href="http://localhost:3000/change-password/${token}">change password</a>`
    );

    return true;
  };

};
