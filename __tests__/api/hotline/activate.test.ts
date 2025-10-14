import { POST } from '@/app/api/hotline/activate/route';
import { NextRequest } from 'next/server';

describe('Hotline Activate API', () => {
  it('should return 401 if unauthorized', async () => {
    const req = new NextRequest('http://localhost/api/hotline/activate', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  // Add more tests as needed
});
