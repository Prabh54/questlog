import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RegisterSchema } from '@questlog/shared';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from './useAuth';
import { ApiError } from '../../lib/api';

// The API's RegisterSchema plus a client-only confirmation field
const registerSchema = RegisterSchema.extend({
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});
type RegisterFields = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFields>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async ({ confirm_password: _, ...data }: RegisterFields) => {
    setServerError(null);
    try {
      await registerUser(data);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const msg: Record<string, string> = {
          EMAIL_TAKEN: 'That email is already registered',
          USERNAME_TAKEN: 'That display name is taken',
        };
        setServerError(msg[err.code] ?? err.message);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input
        label="Display name"
        type="text"
        autoComplete="username"
        placeholder="HeroOfTime"
        hint="Letters, numbers, _ and - only"
        error={errors.display_name?.message}
        required
        {...register('display_name')}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        required
        {...register('email')}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        hint="Min 8 characters, at least one letter and one number"
        error={errors.password?.message}
        required
        {...register('password')}
      />
      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        error={errors.confirm_password?.message}
        required
        {...register('confirm_password')}
      />

      {serverError && (
        <p className="rounded-lg bg-danger-500/10 border border-danger-500/30 px-4 py-2.5 text-sm text-danger-400">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Create account
      </Button>

      <p className="text-center text-sm text-surface-400">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          Sign in
        </Link>
      </p>
    </form>
  );
}
