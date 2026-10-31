import { NextResponse } from 'next/server';

const RPC_URL = process.env.GENLAYER_RPC_URL ?? 'https://studio.genlayer.com/api';

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = JSON.parse(raw);
    const upstream = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    return new NextResponse(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: `GenLayer RPC unreachable: ${message}` },
        id: null,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
