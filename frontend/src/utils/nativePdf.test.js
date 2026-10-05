import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';
import { Share } from '@capacitor/share';
import { cacheNativePdf, openNativePdf, shareNativePdf } from './nativePdf';

jest.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: jest.fn() },
}));
jest.mock('@capacitor/file-viewer', () => ({ FileViewer: { openDocumentFromLocalPath: jest.fn() } }));
jest.mock('@capacitor/share', () => ({ Share: { share: jest.fn() } }));

test('keeps a PDF in the app cache for native preview and sharing', async () => {
  Filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/receipt.pdf' });
  FileViewer.openDocumentFromLocalPath.mockResolvedValue();
  Share.share.mockResolvedValue();

  const uri = await cacheNativePdf(new Blob(['PDF'], { type: 'application/pdf' }), 'orden/REP-1');
  expect(Filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({
    path: expect.stringMatching(/^ifixflow-\d+-orden_REP-1\.pdf$/),
    data: 'UERG',
    directory: Directory.Cache,
  }));
  expect(uri).toBe('file:///cache/receipt.pdf');
  await openNativePdf(uri);
  expect(FileViewer.openDocumentFromLocalPath).toHaveBeenCalledWith({ path: '/cache/receipt.pdf' });
  await shareNativePdf(uri, 'Orden REP-1');
  expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({ files: [uri], title: 'Orden REP-1' }));
});
