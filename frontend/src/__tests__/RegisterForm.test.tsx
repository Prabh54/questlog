import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '../features/auth/RegisterForm';
import { renderWithProviders } from '../test/utils';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../features/auth/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: mockRegister,
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

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Passwords do not match" when password and confirm_password differ', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    await user.type(screen.getByLabelText(/display name/i), 'Hero123');
    await user.type(screen.getByLabelText(/^email/i), 'hero@example.com');
    // Use getAllByLabelText and pick the first (Password) vs Confirm password
    const passwordInputs = screen.getAllByLabelText(/password/i);
    await user.type(passwordInputs[0], 'Password1');
    await user.type(passwordInputs[1], 'Different1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('shows "At least 8 characters" when password is too short', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    await user.type(screen.getByLabelText(/display name/i), 'Hero123');
    await user.type(screen.getByLabelText(/^email/i), 'hero@example.com');
    const passwordInputs = screen.getAllByLabelText(/password/i);
    await user.type(passwordInputs[0], 'Pass1');
    await user.type(passwordInputs[1], 'Pass1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('At least 8 characters')).toBeInTheDocument();
  });

  it('shows "Must contain a number" when password has no digit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    await user.type(screen.getByLabelText(/display name/i), 'Hero123');
    await user.type(screen.getByLabelText(/^email/i), 'hero@example.com');
    const passwordInputs = screen.getAllByLabelText(/password/i);
    await user.type(passwordInputs[0], 'PasswordOnly');
    await user.type(passwordInputs[1], 'PasswordOnly');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Must contain a number')).toBeInTheDocument();
  });

  it('shows "At least 3 characters" when display_name is too short', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    await user.type(screen.getByLabelText(/display name/i), 'Hi');
    await user.type(screen.getByLabelText(/^email/i), 'hero@example.com');
    const passwordInputs = screen.getAllByLabelText(/password/i);
    await user.type(passwordInputs[0], 'Password1');
    await user.type(passwordInputs[1], 'Password1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('At least 3 characters')).toBeInTheDocument();
  });

  it('calls register with display_name, email, and password (not confirm_password) on valid submission', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue(undefined);
    renderWithProviders(<RegisterForm />);

    await user.type(screen.getByLabelText(/display name/i), 'HeroOfTime');
    await user.type(screen.getByLabelText(/^email/i), 'hero@example.com');
    const passwordInputs = screen.getAllByLabelText(/password/i);
    await user.type(passwordInputs[0], 'Password1');
    await user.type(passwordInputs[1], 'Password1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        display_name: 'HeroOfTime',
        email: 'hero@example.com',
        password: 'Password1',
      });
    });
    expect(mockRegister).not.toHaveBeenCalledWith(
      expect.objectContaining({ confirm_password: expect.anything() }),
    );
  });
});
