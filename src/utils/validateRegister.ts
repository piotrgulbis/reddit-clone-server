import { UsernamePasswordInput } from 'src/resolvers/UsernamePasswordInput';

export const validateRegister = (options: UsernamePasswordInput) => {
  // Piotr 20.01.2022: TODO: Implement better email address validation.
  if (!options.email.includes('@')) {
    return [
      {
        field: 'email',
        message: 'The email address is invalid.',
      },
    ];
  }

  if (options.username.length <= 2) {
    return [
      {
        field: 'username',
        message: 'The username must be at least three characters long.',
      },
    ];
  }

  if (options.username.includes('@')) {
    return [
      {
        field: 'username',
        message: 'The username is invalid.',
      },
    ];
  }

  // Piotr 15.01.2022: TODO: Implement strong password validation using a library
  // or at least a regex expression.
  if (options.password.length <= 5) {
    return [
      {
        field: 'password',
        message: 'The password must be at least six characters long.',
      },
    ];
  }

  return null;
};
