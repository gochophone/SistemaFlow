import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('axios');

const SessionState = () => {
  const { user, token, loading, authError } = useAuth();
  return <div data-testid="session-state">{JSON.stringify({ user, token, loading, authError })}</div>;
};

let container;
let root;

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});

const state = () => JSON.parse(container.querySelector('[data-testid="session-state"]').textContent);

test('restaura el token guardado al volver a abrir la aplicación', async () => {
  localStorage.setItem('token', 'saved-token');
  axios.get.mockResolvedValue({ data: { id: 'user-1', name: 'Admin' } });

  await act(async () => root.render(<AuthProvider><SessionState /></AuthProvider>));
  expect(state()).toMatchObject({ user: { id: 'user-1' }, token: 'saved-token', loading: false });
  await act(async () => root.unmount());

  root = createRoot(container);
  await act(async () => root.render(<AuthProvider><SessionState /></AuthProvider>));
  expect(state()).toMatchObject({ user: { id: 'user-1' }, token: 'saved-token', loading: false });
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem('token')).toBe('saved-token');
});

test('un 403 temporal no elimina la sesión guardada', async () => {
  localStorage.setItem('token', 'saved-token');
  axios.get.mockRejectedValueOnce({ response: { status: 403 } })
    .mockResolvedValueOnce({ data: { id: 'user-1' } });

  await act(async () => root.render(<AuthProvider><SessionState /></AuthProvider>));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 900)); });
  expect(state()).toMatchObject({ user: { id: 'user-1' }, token: 'saved-token', loading: false });
  expect(localStorage.getItem('token')).toBe('saved-token');
});

test('un token invalidado con 401 sí obliga a iniciar sesión', async () => {
  localStorage.setItem('token', 'expired-token');
  axios.get.mockRejectedValue({ response: { status: 401 } });

  await act(async () => root.render(<AuthProvider><SessionState /></AuthProvider>));
  expect(state()).toMatchObject({ user: null, token: null, loading: false });
  expect(localStorage.getItem('token')).toBeNull();
});
