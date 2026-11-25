import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif'
};

const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  ogv: 'video/ogg',
  '3gp': 'video/3gpp',
  flv: 'video/x-flv',
  wmv: 'video/x-ms-wmv',
  ts: 'video/mp2t'
};

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  aac: 'audio/aac'
};

export interface VideoMetadata {
  durationSeconds?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  fps?: number;
  sizeBytes?: number;
}

export interface VideoKeyframe {
  timestampSeconds: number;
  dataUrl: string;
}

export function extensionOf(filePath: string): string {
  const ext = extname(filePath).replace(/^\./, '').toLowerCase();
  return ext;
}

export function detectMediaMime(filePath: string, declaredMime = ''): string {
  const ext = extensionOf(filePath);
  // Treat `.ts` as TypeScript source rather than MPEG-TS video unless explicitly declared video/*.
  if (ext === 'ts' && !declaredMime.toLowerCase().startsWith('video/')) {
    return declaredMime && declaredMime !== 'application/octet-stream' ? declaredMime : 'text/typescript';
  }
  const normalizedDeclared = String(declaredMime || '').trim().toLowerCase();
  if (normalizedDeclared && normalizedDeclared !== 'application/octet-stream' && !normalizedDeclared.endsWith('/*')) {
    return normalizedDeclared;
  }
  if (IMAGE_MIME_BY_EXT[ext]) return IMAGE_MIME_BY_EXT[ext]!;
  if (VIDEO_MIME_BY_EXT[ext]) return VIDEO_MIME_BY_EXT[ext]!;
  if (AUDIO_MIME_BY_EXT[ext]) return AUDIO_MIME_BY_EXT[ext]!;
  return normalizedDeclared || 'application/octet-stream';
}

export function isImageMedia(filePath: string, mimeType = ''): boolean {
  const mime = detectMediaMime(filePath, mimeType);
  return mime.startsWith('image/');
}

export function isVideoMedia(filePath: string, mimeType = ''): boolean {
  const ext = extensionOf(filePath);
  if (ext === 'ts' && !mimeType.toLowerCase().startsWith('video/')) return false;
  const mime = detectMediaMime(filePath, mimeType);
  return mime.startsWith('video/');
}

export function isModelSupportedImageMime(mime: string): boolean {
  return /^image\/(?:png|jpeg|webp|gif)$/i.test(mime);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatMediaDuration(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export async function probeVideoMetadata(filePath: string): Promise<VideoMetadata> {
  const result: VideoMetadata = {};
  try {
    const info = await stat(filePath);
    result.sizeBytes = info.size;
  } catch {
    return result;
  }
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ], { timeout: 10_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        avg_frame_rate?: string;
      }>;
    };
    const duration = Number(parsed.format?.duration);
    if (Number.isFinite(duration) && duration >= 0) result.durationSeconds = duration;
    const videoStream = parsed.streams?.find((stream) => stream.codec_type === 'video');
    const audioStream = parsed.streams?.find((stream) => stream.codec_type === 'audio');
    if (videoStream) {
      if (typeof videoStream.width === 'number') result.width = videoStream.width;
      if (typeof videoStream.height === 'number') result.height = videoStream.height;
      if (videoStream.codec_name) result.videoCodec = videoStream.codec_name;
      if (videoStream.avg_frame_rate && videoStream.avg_frame_rate.includes('/')) {
        const [num, den] = videoStream.avg_frame_rate.split('/').map(Number);
        if (num && den && Number.isFinite(num / den)) result.fps = Math.round((num / den) * 100) / 100;
      }
    }
    if (audioStream?.codec_name) result.audioCodec = audioStream.codec_name;
  } catch {
    // ffprobe is optional; gracefully fall back to file size only.
  }
  return result;
}

export async function extractVideoPoster(filePath: string, durationSeconds?: number): Promise<string | undefined> {
  if (!existsSync(filePath)) return undefined;
  const workDir = await mkdtemp(join(tmpdir(), 'relaycode-poster-'));
  const outputPath = join(workDir, 'poster.jpg');
  const seekSeconds = durationSeconds && durationSeconds > 2 ? Math.min(2, durationSeconds * 0.12) : 0;
  try {
    await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      ...(seekSeconds > 0 ? ['-ss', seekSeconds.toFixed(2)] : []),
      '-i', filePath,
      '-frames:v', '1',
      '-vf', "scale='min(480,iw)':-2",
      '-q:v', '5',
      outputPath
    ], { timeout: 12_000, windowsHide: true });
    const bytes = await readFile(outputPath);
    if (bytes.byteLength > 0 && bytes.byteLength <= 512_000) {
      return `data:image/jpeg;base64,${bytes.toString('base64')}`;
    }
  } catch {
    // ffmpeg optional or codec unsupported for thumbnail.
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
  return undefined;
}

export async function extractVideoKeyframes(
  filePath: string,
  metadata?: VideoMetadata,
  maxFrames = 6
): Promise<VideoKeyframe[]> {
  if (!existsSync(filePath)) return [];
  const meta = metadata ?? await probeVideoMetadata(filePath);
  const duration = meta.durationSeconds;
  const frameCount = Math.max(1, Math.min(maxFrames, duration && duration < 4 ? 3 : maxFrames));
  const workDir = await mkdtemp(join(tmpdir(), 'relaycode-frames-'));
  try {
    const frames: VideoKeyframe[] = [];
    if (duration && duration > 0.5) {
      const timestamps = Array.from({ length: frameCount }, (_, index) => {
        if (frameCount === 1) return Math.min(1, duration * 0.25);
        const ratio = (index + 0.5) / frameCount;
        return Math.max(0, Math.min(Math.max(0, duration - 0.1), duration * ratio));
      });
      for (let index = 0; index < timestamps.length; index++) {
        const ts = timestamps[index]!;
        const target = join(workDir, `frame-${index}.jpg`);
        try {
          await execFileAsync('ffmpeg', [
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
            '-ss', ts.toFixed(2),
            '-i', filePath,
            '-frames:v', '1',
            '-vf', "scale='min(1024,iw)':-2",
            '-q:v', '5',
            target
          ], { timeout: 15_000, windowsHide: true });
          const bytes = await readFile(target);
          if (bytes.byteLength > 0 && bytes.byteLength <= 1_200_000) {
            frames.push({
              timestampSeconds: ts,
              dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`
            });
          }
        } catch {
          // Skip unreadable seek positions and continue with remaining frames.
        }
      }
      if (frames.length) return frames;
    }
    // Fallback when duration is unknown (e.g., streaming WebM/MKV): extract initial frames sequentially.
    const pattern = join(workDir, 'seq-%02d.jpg');
    await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', filePath,
      '-vf', "fps=1/3,scale='min(1024,iw)':-2",
      '-frames:v', String(frameCount),
      '-q:v', '5',
      pattern
    ], { timeout: 25_000, windowsHide: true });
    const files = (await readdir(workDir)).filter((name) => name.endsWith('.jpg')).sort();
    for (let index = 0; index < files.length; index++) {
      const bytes = await readFile(join(workDir, files[index]!));
      if (bytes.byteLength > 0 && bytes.byteLength <= 1_200_000) {
        frames.push({
          timestampSeconds: index * 3,
          dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`
        });
      }
    }
    return frames;
  } catch {
    return [];
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function prepareLargeImageForModel(filePath: string, mimeType: string, sizeBytes: number): Promise<string | undefined> {
  if (!existsSync(filePath)) return undefined;
  const normalizedMime = detectMediaMime(filePath, mimeType);
  if (sizeBytes <= 4 * 1024 * 1024 && isModelSupportedImageMime(normalizedMime)) {
    const bytes = await readFile(filePath);
    return `data:${normalizedMime};base64,${bytes.toString('base64')}`;
  }
  // Downscale large images (> 4MB) or convert exotic image formats (bmp/avif) into a crisp JPEG
  // so unlimited-size local images can still be sent to vision models without hitting API payload caps.
  const workDir = await mkdtemp(join(tmpdir(), 'relaycode-img-'));
  const outputPath = join(workDir, 'resized.jpg');
  try {
    await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', filePath,
      '-frames:v', '1',
      '-vf', "scale='min(1600,iw)':-2",
      '-q:v', '4',
      outputPath
    ], { timeout: 15_000, windowsHide: true });
    const bytes = await readFile(outputPath);
    if (bytes.byteLength > 0 && bytes.byteLength <= 4 * 1024 * 1024) {
      return `data:image/jpeg;base64,${bytes.toString('base64')}`;
    }
  } catch {
    // Fallback if ffmpeg is unavailable and original image is under 16MB.
    if (sizeBytes <= 16 * 1024 * 1024 && isModelSupportedImageMime(normalizedMime)) {
      const bytes = await readFile(filePath).catch(() => undefined);
      if (bytes) return `data:${normalizedMime};base64,${bytes.toString('base64')}`;
    }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
  return undefined;
}

export async function extractVideoAudio(
  filePath: string,
  maxDurationSeconds = 300
): Promise<{ audioPath: string; cleanup: () => Promise<void> } | undefined> {
  if (!existsSync(filePath)) return undefined;
  const workDir = await mkdtemp(join(tmpdir(), 'relaycode-audio-'));
  const audioPath = join(workDir, 'track.mp3');
  const cleanup = () => rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  try {
    await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', filePath,
      '-vn',
      '-t', String(Math.max(10, maxDurationSeconds)),
      '-ac', '1',
      '-ar', '16000',
      '-b:a', '48k',
      audioPath
    ], { timeout: 25_000, windowsHide: true });
    const info = await stat(audioPath);
    if (info.size > 0 && info.size <= 20 * 1024 * 1024) {
      return { audioPath, cleanup };
    }
  } catch {
    // Video may have no audio track or ffmpeg may be unavailable.
  }
  await cleanup();
  return undefined;
}

export async function transcribeVideoAudio(
  filePath: string,
  endpoint: string,
  apiKey: string,
  metadata?: VideoMetadata,
  signal?: AbortSignal
): Promise<string | undefined> {
  if (metadata && !metadata.audioCodec) return undefined;
  const extracted = await extractVideoAudio(filePath);
  if (!extracted) return undefined;
  try {
    const base = endpoint.trim().replace(/\/+$/, '');
    if (!base) return undefined;
    const bytes = await readFile(extracted.audioPath);
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'audio/mpeg' }), 'audio.mp3');
    form.append('model', 'whisper-1');
    const headers: Record<string, string> = {};
    if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
    const timeoutSignal = AbortSignal.timeout(25_000);
    const mergedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const response = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: form,
      signal: mergedSignal
    });
    if (!response.ok) return undefined;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const parsed = await response.json() as { text?: unknown };
      const text = typeof parsed.text === 'string' ? parsed.text.replace(/\s+/g, ' ').trim() : '';
      return text ? text.slice(0, 12_000) : undefined;
    }
    const plain = (await response.text()).replace(/\s+/g, ' ').trim();
    return plain ? plain.slice(0, 12_000) : undefined;
  } catch {
    // Audio transcription is best-effort; skip silently when provider does not support Whisper.
    return undefined;
  } finally {
    await extracted.cleanup();
  }
}
