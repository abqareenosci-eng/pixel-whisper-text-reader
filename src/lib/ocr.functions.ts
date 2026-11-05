import { parsePassportText } from '@/lib/mrz';

export type OcrResponse =
  | { ok: true; data: Record<string, string | number>; confidence: number }
  | { ok: false; code: 'BAD_IMAGE' | 'NO_TEXT' | 'FAILED'; message: string };

type TesseractModule = {
  createWorker: (
    langs: string,
    oem?: number,
    options?: { logger?: (message: { status?: string; progress?: number }) => void; workerPath?: string; corePath?: string; langPath?: string },
  ) => Promise<{
    recognize: (image: File | Blob | string) => Promise<{ data: { text: string; confidence?: number } }>;
    terminate: () => Promise<unknown>;
  }>;
};

/** Runs OCR in the user's browser. Passport images are not sent to our server or an OCR API. */
export async function scanPassport(
  image: File,
  onProgress?: (progress: number, status: string) => void,
): Promise<OcrResponse> {
  if (!(image instanceof Blob) || !image.type.startsWith('image/')) {
    return { ok: false, code: 'BAD_IMAGE', message: 'Choose a valid passport image (JPG or PNG).' };
  }

  let worker: Awaited<ReturnType<TesseractModule['createWorker']>> | undefined;
  try {
    // Tesseract.js is loaded from its public open-source distribution; this is a library download, not a paid OCR API.
    // @ts-expect-error Tesseract is loaded as a browser-native remote ESM module.
    const tesseract = (await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/tesseract.js@6/+esm')) as TesseractModule;
    worker = await tesseract.createWorker('eng', 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      logger: (message) => onProgress?.(Math.round((message.progress || 0) * 100), message.status || 'Reading passport'),
    });
    const mrzImage = await prepareMrzImage(image);
    const { data } = await worker.recognize(mrzImage);
    const text = data.text || '';
    if (!text.trim()) {
      return { ok: false, code: 'NO_TEXT', message: 'No text was detected. Use a clear, well-lit image with the passport flat and in focus.' };
    }
    const parsed = parsePassportText(text);
    delete parsed.raw_text;
    return {
      ok: true,
      data: parsed as Record<string, string | number>,
      confidence: Math.max(0, Math.min(1, (data.confidence || 0) / 100)),
    };
  } catch (error) {
    console.error('Browser OCR failed', error);
    return { ok: false, code: 'FAILED', message: 'The browser OCR engine could not load or process this image. Check your internet connection and try again, or enter the details manually.' };
  } finally {
    if (worker) await worker.terminate().catch(() => undefined);
  }
}


/** Crop and enlarge the lower passport zone where the two MRZ lines are printed. */
async function prepareMrzImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const sourceY = Math.floor(bitmap.height * 0.58);
    const sourceHeight = bitmap.height - sourceY;
    const scale = Math.min(3, Math.max(2, 1800 / bitmap.width));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, sourceY, bitmap.width, sourceHeight, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const gray = Math.round(pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114);
      const contrast = gray > 155 ? 255 : gray < 105 ? 0 : Math.round((gray - 105) * 5.1);
      pixels.data[i] = contrast;
      pixels.data[i + 1] = contrast;
      pixels.data[i + 2] = contrast;
    }
    context.putImageData(pixels, 0, 0);
    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob || file), 'image/png'));
  } finally {
    bitmap.close();
  }
}
