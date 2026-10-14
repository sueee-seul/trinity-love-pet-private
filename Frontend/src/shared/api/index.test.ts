import { describe, expect, it } from 'vitest';
import { resolveApiOrigin, toWebSocketUrl } from './index';

describe('resolveApiOrigin', () => {
  it('uses the local Backend when the build names none', () => {
    expect(resolveApiOrigin(undefined)).toBe('http://localhost:3000');
    expect(resolveApiOrigin('   ')).toBe('http://localhost:3000');
  });

  it('uses the configured origin without a trailing slash', () => {
    expect(resolveApiOrigin('https://api.example.co.nz/')).toBe('https://api.example.co.nz');
    expect(resolveApiOrigin(' https://api.example.co.nz ')).toBe('https://api.example.co.nz');
  });

  it('turns an https origin into a secure socket address', () => {
    expect(toWebSocketUrl('https://api.example.co.nz/api/speech/stream')).toBe(
      'wss://api.example.co.nz/api/speech/stream',
    );
  });
});
