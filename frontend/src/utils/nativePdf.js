import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';
import { Share } from '@capacitor/share';

export const isNativeApp = () => Capacitor.isNativePlatform();

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(reader.error || new Error('No se pudo preparar el PDF'));
  reader.readAsDataURL(blob);
});

export const cacheNativePdf = async (blob, name) => {
  const safeName = String(name).replace(/[^a-zA-Z0-9_-]/g, '_');
  const result = await Filesystem.writeFile({
    path: `ifixflow-${Date.now()}-${safeName}.pdf`,
    data: await toBase64(blob),
    directory: Directory.Cache,
  });
  return result.uri;
};

export const openNativePdf = (uri) => FileViewer.openDocumentFromLocalPath({
  path: uri.startsWith('file://') ? decodeURIComponent(new URL(uri).pathname) : uri,
});

export const shareNativePdf = (uri, title, text) => Share.share({
  title,
  ...(text ? { text } : {}),
  files: [uri],
  dialogTitle: 'Guardar, imprimir o compartir PDF',
});
