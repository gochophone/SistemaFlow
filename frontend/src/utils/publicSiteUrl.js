import { isNativeApp } from '@/utils/nativePdf';

export const publicSiteUrl = () => isNativeApp()
  ? 'https://ifixflow.com'
  : window.location.origin;
