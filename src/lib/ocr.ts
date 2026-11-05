import { compressImage } from '@/lib/image';
import { extractPassport, type OcrResponse } from '@/lib/ocr.functions';

export type { OcrResponse };

/** Shrinks the photo in the browser, then asks the server to read it with Lovable AI. */
export async function scanPassport(
  image: File,
  onProgress?: (progress: number, status: string) => void,
): Promise<OcrResponse> {
  if (!(image instanceof Blob) || (!image.type.startsWith('image/') && !/\.(heic|heif)$/i.test(image.name))) {
    return { ok: false, code: 'BAD_IMAGE', message: 'Choose a valid passport image (JPG or PNG).' };
  }

  onProgress?.(10, 'Preparing photo');
  let dataUrl: string;
  try {
    ({ dataUrl } = await compressImage(image, 1800, 0.88));
  } catch {
    return { ok: false, code: 'BAD_IMAGE', message: 'This photo could not be opened. Please use a JPG or PNG image.' };
  }
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) {
    return { ok: false, code: 'BAD_IMAGE', message: 'This photo format is not supported on this device. Please use a JPG or PNG image.' };
  }

  onProgress?.(40, 'Reading passport');
  // Smoothly advance the bar while waiting for the server.
  let pct = 40;
  const timer = setInterval(() => {
    pct = Math.min(92, pct + 4);
    onProgress?.(pct, 'Reading passport');
  }, 600);
  try {
    const result = await extractPassport({ data: { image: dataUrl } });
    onProgress?.(100, 'Done');
    return result;
  } catch (error) {
    console.error('Passport scan request failed', error);
    return { ok: false, code: 'FAILED', message: 'We could not reach the passport reader. Check your connection and try again, or enter your details manually.' };
  } finally {
    clearInterval(timer);
  }
}
