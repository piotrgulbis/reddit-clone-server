import {
    Arg, Ctx, Field, InputType, Int, Mutation, Query, Resolver, UseMiddleware
} from 'type-graphql';

import { Post } from '../entities/Post';
import { isAuth } from '../middleware/isAuth';
import { MyContext } from '../types';

@InputType()
class PostInput {
  @Field()
  title: string
  @Field()
  content: string
}

@Resolver()
export class PostResolver {
  @Query(() => [Post])
  posts(): Promise<Post[]> {
    return Post.find();
  };

  @Query(() => Post, { nullable: true })
  post(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  };

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg('input', () => PostInput) input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({
      ...input,
      authorId: req.session.userId
    }).save();
  };

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title', () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }
    if (typeof title !== 'undefined') {
      await Post.update({id}, {title});
    }
    return post;
  };

  @Mutation(() => Number)
  async deletePost(@Arg('id', () => Int) id: number): Promise<boolean> {
    await Post.delete(id);
    return true;
  };
};
