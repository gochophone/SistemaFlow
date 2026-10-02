import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import DevicePhotos from './DevicePhotos';

jest.mock('axios');
jest.mock('sonner', () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }));

let container;
let root;

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({
    data: { signature: 'signature', timestamp: 123, cloud_name: 'cloud', api_key: 'key', folder: 'tenant/repairs' },
  });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/cloud/image/upload/v123/tenant/repairs/photo.jpg' }) });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const uploadPhoto = async () => {
  const file = new File(['photo'], 'photo.png', { type: 'image/png' });
  const input = container.querySelector('input[multiple]');
  await act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

test('saves an uploaded photo before reporting success', async () => {
  const onChange = jest.fn().mockResolvedValue();
  await act(async () => root.render(<DevicePhotos photos={[]} onChange={onChange} authHeader={{ Authorization: 'Bearer test' }} />));
  await uploadPhoto();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/cloudinary/signature'), expect.anything());
  expect(onChange).toHaveBeenCalledWith(['https://res.cloudinary.com/cloud/image/upload/v123/tenant/repairs/photo.jpg']);
  expect(toast.success).toHaveBeenCalledTimes(1);
});

test('reports a save failure instead of claiming the photo was added', async () => {
  const onChange = jest.fn().mockRejectedValue({ response: { data: { detail: 'La orden ya está cerrada' } } });
  await act(async () => root.render(<DevicePhotos photos={[]} onChange={onChange} authHeader={{ Authorization: 'Bearer test' }} />));
  await uploadPhoto();
  expect(toast.error).toHaveBeenCalledWith('La orden ya está cerrada');
  expect(toast.success).not.toHaveBeenCalled();
});
