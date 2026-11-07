import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Login from './Login';

let mockAuth;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Navigate: ({ to }) => <span data-testid="redirect" data-to={to} />,
}), { virtual: true });

let container;
let root;

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });

beforeEach(() => {
  mockAuth = { user: null, token: null, loading: false, authError: '', restoreSession: jest.fn() };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test('si ya existe una sesión, /login abre el sistema sin pedir contraseña', async () => {
  mockAuth.user = { id: 'user-1' };
  mockAuth.token = 'saved-token';
  await act(async () => root.render(<Login />));
  expect(container.querySelector('[data-testid="redirect"]').getAttribute('data-to')).toBe('/');
  expect(container.querySelector('[data-testid="login-password-input"]')).toBeNull();
});

test('mientras se restaura la sesión, no muestra el formulario de ingreso', async () => {
  mockAuth.token = 'saved-token';
  mockAuth.loading = true;
  await act(async () => root.render(<Login />));
  expect(container.textContent).toBe('');
});
