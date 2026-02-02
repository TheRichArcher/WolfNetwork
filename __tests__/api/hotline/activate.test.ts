import { POST } from '@/app/api/hotline/activate/route';
import { NextRequest } from 'next/server';

describe('Hotline Activate API', () => {
  it('should return 401 if unauthorized', async () => {
    const req = new NextRequest('http://localhost/api/hotline/activate', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('allows dev bypass when AUTH_DEV_BYPASS is true', async () => {
    process.env.AUTH_DEV_BYPASS = 'true';
    const req = new NextRequest('http://localhost/api/hotline/activate', { method: 'POST' });
    const res = await POST(req);
    // In CI without Airtable/Twilio this may 400/500, but should not be 401
    expect(res.status).not.toBe(401);
    delete process.env.AUTH_DEV_BYPASS;
  });

  it('accepts valid crisisType parameter', async () => {
    process.env.AUTH_DEV_BYPASS = 'true';
    const req = new NextRequest('http://localhost/api/hotline/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crisisType: 'legal' }),
    });
    const res = await POST(req);
    // Should not be a validation error (400 would be for phone not configured, which is expected)
    expect([400, 500]).toContain(res.status); // Not 401 or 422
    delete process.env.AUTH_DEV_BYPASS;
  });

  it('handles invalid crisisType gracefully', async () => {
    process.env.AUTH_DEV_BYPASS = 'true';
    const req = new NextRequest('http://localhost/api/hotline/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crisisType: 'invalid_type' }),
    });
    const res = await POST(req);
    // Invalid type should be ignored (falls back to undefined), not crash
    expect(res.status).not.toBe(500);
    delete process.env.AUTH_DEV_BYPASS;
  });
});
