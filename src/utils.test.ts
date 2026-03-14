import { describe, it, expect } from 'vitest';
import { getDomain, getYouTubeId } from './utils';

describe('getDomain', () => {
  it('extracts hostname from valid URL', () => {
    expect(getDomain('https://www.example.com/path')).toBe('www.example.com');
    expect(getDomain('http://sub.domain.org')).toBe('sub.domain.org');
  });

  it('returns "unknown" for invalid URLs', () => {
    expect(getDomain('not-a-url')).toBe('unknown');
    expect(getDomain('')).toBe('unknown');
  });
});

describe('getYouTubeId', () => {
  it('extracts video ID from various YouTube URL formats', () => {
    expect(getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(getYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(getYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube URLs or invalid formats', () => {
    expect(getYouTubeId('https://vimeo.com/123456')).toBeNull();
    expect(getYouTubeId('not-a-url')).toBeNull();
    expect(getYouTubeId('')).toBeNull();
  });
});
