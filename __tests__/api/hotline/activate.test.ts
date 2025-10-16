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
});
