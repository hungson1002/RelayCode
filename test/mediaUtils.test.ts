import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  detectMediaMime,
  extractVideoKeyframes,
  extractVideoPoster,
  formatFileSize,
  formatMediaDuration,
  isImageMedia,
  isVideoMedia,
  probeVideoMetadata
} from '../src/mediaUtils';

const execFileAsync = promisify(execFile);

describe('mediaUtils', () => {
  it('detects image, video and TypeScript MIME types without misclassifying .ts files as video', () => {
    expect(detectMediaMime('demo.mp4')).toBe('video/mp4');
    expect(detectMediaMime('clip.mkv')).toBe('video/x-matroska');
    expect(detectMediaMime('recording.mov')).toBe('video/quicktime');
    expect(detectMediaMime('capture.webm')).toBe('video/webm');
    expect(detectMediaMime('shot.PNG')).toBe('image/png');
    expect(detectMediaMime('photo.jpg', 'image/*')).toBe('image/jpeg');
    expect(detectMediaMime('src/app.ts')).toBe('text/typescript');
    expect(isVideoMedia('demo.mp4')).toBe(true);
    expect(isVideoMedia('src/app.ts')).toBe(false);
    expect(isVideoMedia('broadcast.ts', 'video/mp2t')).toBe(true);
    expect(isImageMedia('photo.webp')).toBe(true);
    expect(isImageMedia('demo.mp4')).toBe(false);
  });

  it('formats file sizes and media durations cleanly', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    expect(formatMediaDuration(7)).toBe('0:07');
    expect(formatMediaDuration(125)).toBe('2:05');
    expect(formatMediaDuration(3661)).toBe('1:01:01');
    expect(formatMediaDuration(undefined)).toBe('');
  });

  it('probes metadata and extracts poster & keyframes for local videos when ffmpeg is available', async () => {
    let hasFfmpeg = false;
    try {
      await execFileAsync('ffmpeg', ['-version'], { timeout: 5_000, windowsHide: true });
      hasFfmpeg = true;
    } catch {
      hasFfmpeg = false;
    }
    if (!hasFfmpeg) return;

    const dir = await mkdtemp(join(tmpdir(), 'relaycode-media-test-'));
    const videoPath = join(dir, 'sample.mp4');
    try {
      await execFileAsync('ffmpeg', [
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-f', 'lavfi',
        '-i', 'color=c=0x1e88e5:s=320x180:d=2',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        videoPath
      ], { timeout: 15_000, windowsHide: true });

      const meta = await probeVideoMetadata(videoPath);
      expect(meta.sizeBytes).toBeGreaterThan(0);
      expect(meta.width).toBe(320);
      expect(meta.height).toBe(180);
      expect(meta.durationSeconds).toBeGreaterThan(1);

      const poster = await extractVideoPoster(videoPath, meta.durationSeconds);
      expect(poster).toMatch(/^data:image\/jpeg;base64,/);

      const frames = await extractVideoKeyframes(videoPath, meta, 3);
      expect(frames.length).toBeGreaterThanOrEqual(2);
      expect(frames[0]?.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);
});
