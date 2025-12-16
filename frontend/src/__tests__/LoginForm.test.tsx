import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../features/auth/LoginForm';
import { renderWithProviders } from '../test/utils';
import { ApiError } from '../lib/api';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../features/auth/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: vi.fn(),
    logout: vi.fn(),
    updateMe: vi.fn(),
    user: null,
    token: null,
    isLoading: false,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation errors when submitted with empty fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('shows password error when email is valid but password is too short', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'hero@example.com');
    // Empty password, click submit — zod min(1) fires "Password is required"
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(screen.queryByText('Enter a valid email')).not.toBeInTheDocument();
  });

  it('calls login with email and password on valid submission', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'hero@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'hero@example.com',
        password: 'secret123',
      });
    });
  });

  it('shows "Invalid email or password" when login throws ApiError with INVALID_CREDENTIALS', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Bad credentials'));
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'hero@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});
