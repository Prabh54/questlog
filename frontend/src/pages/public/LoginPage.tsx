import { Zap } from 'lucide-react';
import { LoginForm } from '../../features/auth/LoginForm';
import { Card } from '../../components/ui/Card';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Zap className="mx-auto mb-3 h-10 w-10 text-primary-500" />
          <h1 className="text-2xl font-bold text-surface-50">Welcome back</h1>
          <p className="mt-1 text-sm text-surface-400">Sign in to continue your journey</p>
        </div>
        <Card>
          <LoginForm />
        </Card>
      </div>
    </div>
  );
}
