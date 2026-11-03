/**
 * Read-only client for the UnderCollateralizedLending contract on GenLayer.
 *
 * All state reads go through the `/api/rpc` JSON-RPC proxy which forwards to
 * the GenLayer studio RPC endpoint. Writes are executed by the connected EVM
 * wallet via EIP-1193 and are submitted through the GenLayer consensus layer.
 */

import { createWalletClient, custom, encodeFunctionData, defineChain } from 'viem';
import type { Abi, Hash, WalletClient } from 'viem';

export const CONTRACT_ADDRESS = '0x1912fcB4C281c28FE8376C8563075F309AAe834e';
export const CHAIN_ID = '0xf22f';

/** GenLayer Studionet — EIP-1193 chain the wallets are pointed at. */
export const GENLAYER_CHAIN = defineChain({
  id: 61999,
  name: 'Genlayer Studio Network',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
});

/** Minimal EIP-1193 surface the write layer needs. */
export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

/** Minimal human-readable ABI of UnderCollaterizedLending (GenLayer VM contract). */
export const UnderCollateralizedLendingABI: Abi = [
  {
    type: 'function',
    name: 'assess_credit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'borrower', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'create_borrower',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'borrower', type: 'string' },
      { name: 'reputation', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'create_loan',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'borrower', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'interest_rate', type: 'uint256' },
    ],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'fund_loan',
    stateMutability: 'payable',
    inputs: [
      { name: 'loan_id', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'disburse_loan',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'loan_id', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'repay_loan',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'loan_id', type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'liquidate_loan',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'loan_id', type: 'string' }],
    outputs: [],
  },
];

export type TxStatus = 'pending' | 'accepted' | 'finalized' | 'error';

export interface TxRecord {
  hash: string;
  status: TxStatus;
  sender?: string;
  blockNumber?: string;
  gasUsed?: string;
  method?: string;
  error?: string;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error) {
    throw new Error(json.error.message ?? `RPC method ${method} failed`);
  }
  return json.result as T;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function readUleb128(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let i = offset;
  for (;;) {
    const b = bytes[i];
    result |= (b & 0x7f) << shift;
    shift += 7;
    i += 1;
    if ((b & 0x80) === 0) break;
  }
  return { value: result, next: i };
}

type DecodeResult = { value: unknown; next: number };

function decodeValue(bytes: Uint8Array, offset: number): DecodeResult {
  const code = readUleb128(bytes, offset);
  const value = code.value;
  const typ = value & 7;
  const bodyStart = code.next;

  if (typ === 0) {
    // special: null (0), false (1), true (2), address (3)
    if (value === 0) return { value: null, next: bodyStart };
    if (value === 1) return { value: false, next: bodyStart };
    if (value === 2) return { value: true, next: bodyStart };
    const addrBytes = bytes.slice(bodyStart, bodyStart + 20);
    const addr = `0x${bytesToHex(addrBytes).toLowerCase()}`;
    return { value: addr, next: bodyStart + 20 };
  }

  const type = value >> 3;
  if (typ === 1) return { value: type, next: bodyStart }; // PINT
  if (typ === 2) return { value: -type - 1, next: bodyStart }; // NINT
  if (typ === 3) {
    // BYTES
    const b = bytes.slice(bodyStart, bodyStart + type);
    return { value: b, next: bodyStart + type };
  }
  if (typ === 4) {
    // STR
    const b = bytes.slice(bodyStart, bodyStart + type);
    const str = new TextDecoder().decode(b);
    return { value: str, next: bodyStart + type };
  }
  if (typ === 5) {
    // ARR
    const arr: unknown[] = [];
    let o = bodyStart;
    for (let i = 0; i < type; i++) {
      const r = decodeValue(bytes, o);
      arr.push(r.value);
      o = r.next;
    }
    return { value: arr, next: o };
  }
  if (typ === 6) {
    // MAP
    const map: Record<string, unknown> = {};
    let o = bodyStart;
    let prev: string | null = null;
    for (let i = 0; i < type; i++) {
      const lenInfo = readUleb128(bytes, o);
      const keyBytes = bytes.slice(lenInfo.next, lenInfo.next + lenInfo.value);
      const key = new TextDecoder().decode(keyBytes);
      prev = key;
      const valInfo = decodeValue(bytes, lenInfo.next + lenInfo.value);
      map[key] = valInfo.value;
      o = valInfo.next;
    }
    return { value: map, next: o };
  }
  throw new Error(`Unsupported GenVM value type tag: ${typ}`);
}

function decodeGenCallResult(hex: string): unknown {
  const clean = hex.replace(/^0x/, '');
  const bytes = hexToBytes(clean);
  const decoded = decodeValue(bytes, 0);
  if (decoded.next !== bytes.length) {
    // tolerate trailing bytes in some payloads
  }
  return decoded.value;
}

async function callRead(method: string, data: string, from: string) {
  const result = await rpc<unknown>('gen_call', [
    {
      type: 'read',
      to: CONTRACT_ADDRESS,
      from,
      data,
      transaction_hash_variant: 'latest-nonfinal',
    },
  ]);
  return result;
}

/** Total number of loans created on-chain. */
export async function getLoanCount(): Promise<number> {
  const result = await callRead(
    'get_loan_count',
    '0xd9970e066d6574686f64746765745f6c6f616e5f636f756e7400',
    '0x0000000000000000000000000000000000000000',
  );
  const decoded = decodeGenCallResult(String(result ?? '')) as { count?: number } | null;
  const parsed = decoded && typeof decoded === 'object' ? decoded : {};
  return Number(parsed.count ?? 0);
}

/** All loan records, keyed by loan id. */
export async function getLoans(): Promise<Record<string, unknown>> {
  const result = await callRead(
    'get_loans',
    '0xd4920e066d6574686f644c6765745f6c6f616e7300',
    '0x0000000000000000000000000000000000000000',
  );
  const decoded = decodeGenCallResult(String(result ?? ''));
  if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
    return decoded as Record<string, unknown>;
  }
  return {};
}

/** Borrower profile of the connected wallet, straight from the contract. */
export async function getBorrowerBySender(address: string): Promise<Record<string, unknown>> {
  const result = await callRead(
    'get_borrower_by_sender',
    '0xe2a00e066d6574686f64b4016765745f626f72726f7765725f62795f73656e64657200',
    address,
  );
  const decoded = decodeGenCallResult(String(result ?? ''));
  if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
    return decoded as Record<string, unknown>;
  }
  return {};
}

/**
 * Resolve the lifecycle status of a GenLayer transaction:
 * pending -> accepted -> finalized | error
 */
export async function getTransactionStatus(txHash: string): Promise<TxRecord> {
  const receipt = await rpc<{
    status?: string;
    blockNumber?: string;
    gasUsed?: string;
    from?: string;
  } | null>('eth_getTransactionReceipt', [txHash]);

  if (!receipt) {
    return { hash: txHash, status: 'pending' };
  }
  if (receipt.status === '0x0') {
    return {
      hash: txHash,
      status: 'error',
      sender: receipt.from,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }

  const tx = await rpc<{ status?: string; from?: string } | null>('eth_getTransactionByHash', [txHash]);

  const status: TxStatus = tx?.status === 'FINALIZED' ? 'finalized' : 'accepted';
  return {
    hash: txHash,
    status,
    sender: tx?.from ?? receipt.from,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  };
}

/* ------------------------------------------------------------------ *
 * Writes — wallet-signed transactions submitted through the GenLayer
 * consensus layer. The connected EIP-1193 wallet signs the transaction
 * (eth_sendTransaction) and the resulting call is settled by the GenLayer
 * leader + validator consensus before it is final.
 * ------------------------------------------------------------------ */

/** GEN has 18 decimals, so amounts are handled as base-unit integers. */
const GEN_UNIT = BigInt(10) ** BigInt(18);

export interface WriteOutcome {
  hash: string;
  ok: boolean;
  error?: string;
}

function walletClientFor(provider: EIP1193Provider, account: string): WalletClient {
  const transport = custom(provider as never);
  return createWalletClient({
    account: account as `0x${string}`,
    chain: GENLAYER_CHAIN,
    transport,
  });
}

async function sendContractCall(
  provider: EIP1193Provider,
  account: string,
  call: { functionName: string; args?: unknown[]; value?: bigint },
): Promise<{ hash: string; ok: boolean; error?: string }> {
  try {
    const walletClient = walletClientFor(provider, account);
    const data = await encodeFunctionData({
      abi: UnderCollateralizedLendingABI,
      functionName: call.functionName,
      args: call.args ?? [],
    });
    const hash = await walletClient.sendTransaction({
      to: CONTRACT_ADDRESS as `0x${string}`,
      data,
      account: account as `0x${string}`,
      chain: GENLAYER_CHAIN,
      ...(call.value !== undefined ? { value: call.value } : {}),
    });
    return { hash, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transaction submission failed.';
    return { hash: '', ok: false, error: message };
  }
}

/** Consensus-driven credit assessment: runs the LLM comparative judgement. */
export async function writeAssessCredit(
  provider: EIP1193Provider,
  account: string,
  borrower: string,
  amount: bigint,
): Promise<{ hash: string; ok: boolean; error?: string }> {
  return sendContractCall(provider, account, { functionName: 'assess_credit', args: [borrower, amount] });
}

/** Register (or refresh) a borrower profile on-chain. */
export async function writeCreateBorrower(
  provider: EIP1193Provider,
  account: string,
  borrower: string,
  reputation: bigint,
): Promise<{ hash: string; ok: boolean; error?: string }> {
  return sendContractCall(provider, account, { functionName: 'create_borrower', args: [borrower, reputation] });
}

/** Open a new loan proposal for a borrower. */
export async function writeCreateLoan(
  provider: EIP1193Provider,
  account: string,
  borrower: string,
  amount: bigint,
  interestRate: bigint,
): Promise<{ hash: string; ok: boolean; error?: string }> {
  return sendContractCall(provider, account, {
    functionName: 'create_loan',
    args: [borrower, amount, interestRate],
  });
}

/** Lock GEN into escrow against a loan request (under-collateralized funding). */
export async function writeFundLoan(
  provider: EIP1193Provider,
  account: string,
  loanId: string,
  amount: bigint,
): Promise<{ hash: string; ok: boolean; error?: string }> {
  return sendContractCall(provider, account, {
    functionName: 'fund_loan',
    args: [loanId, amount],
    value: amount * GEN_UNIT,
  });
}

/** Release escrowed GEN to the borrower after funding. */
export async function writeDisburseLoan(
  provider: EIP1193Provider,
  account: string,
  loanId: string,
  amount: bigint,
): Promise<{ hash: string; ok: boolean; error?: string }> {
  return sendContractCall(provider, account, { functionName: 'disburse_loan', args: [loanId, amount] });
}

/** Mark a loan as repaid; repaid principal returns to escrow. */
export async function writeRepayLoan(
  provider: EIP1193Provider,
  account: string,
  loanId: string,
): Promise<{ hash: string; ok: boolean; error?: string }> {
  return sendContractCall(provider, account, { functionName: 'repay_loan', args: [loanId] });
}

/** Liquidate a loan (mark as defaulted). */
export async function writeLiquidateLoan(
  provider: EIP1193Provider,
  account: string,
  loanId: string,
): Promise<{ hash: string; ok: boolean; error?: string }> {
  return sendContractCall(provider, account, { functionName: 'liquidate_loan', args: [loanId] });
}
