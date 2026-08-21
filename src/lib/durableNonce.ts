import {
    Connection,
    NONCE_ACCOUNT_LENGTH,
    NonceAccount,
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js';

/**
 * Durable nonce helpers.
 *
 * Why: a normal `recentBlockhash` is only valid for ~150 slots (60–90 s). When a
 * wallet shows an interstitial warning ("unrecognized domain", "transaction could
 * not be simulated" — standard for a custom Anchor program on devnet), the user
 * often needs longer than that to read it and approve. The signature then arrives
 * after expiry and the cluster rejects it.
 *
 * A durable nonce removes the time limit entirely: the transaction carries the
 * value stored in an on-chain nonce account, which only changes when a
 * `nonceAdvance` instruction runs.
 *
 * Trade-off: strictly one durable transaction in flight at a time per nonce
 * account. The first one to land advances the nonce and invalidates the others.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT — single-signer design
 * ---------------------------------------------------------------------------
 * The nonce account is created with `createAccountWithSeed`, NOT `createAccount`.
 *
 * `createAccount` requires the brand-new account to sign its own creation, which
 * means the setup transaction has two signers: the wallet and a local throwaway
 * keypair. On Mobile Wallet Adapter that co-signature is a minefield:
 *   - the `signers` option of `sendTransaction` is ignored by MWA;
 *   - the `signTransaction` path carries no `chain`, so Seed Vault falls back to
 *     mainnet and rejects with a network-mismatch error.
 *
 * `createAccountWithSeed` derives the address from (wallet, seed, programId), so
 * only the wallet signs. One signer, no local keypair, no MWA edge cases — and
 * the address is deterministic, so it survives a cleared localStorage.
 */

/** Bump this if the account layout or authority scheme ever changes. */
export const NONCE_SEED = 'durable-nonce-v1';

/**
 * Deterministic nonce account address for a given wallet.
 * Same wallet + same seed always yields the same address, on any device.
 */
export const deriveNonceAccount = (owner: PublicKey): Promise<PublicKey> =>
    PublicKey.createWithSeed(owner, NONCE_SEED, SystemProgram.programId);

export type NonceState = {
    /** The value to use as `recentBlockhash`. */
    nonce: string;
    /** Slot the value was read at — passed as `minContextSlot` to avoid lagging RPC nodes. */
    minContextSlot: number;
};

/**
 * Fetches and validates the on-chain nonce account.
 * Returns `null` when the account is missing, not a nonce account, or controlled
 * by a different authority — in which case the caller should (re)create one.
 */
export const fetchNonceState = async (
    connection: Connection,
    noncePubkey: PublicKey,
    expectedAuthority: PublicKey,
): Promise<NonceState | null> => {
    const { context, value } = await connection.getAccountInfoAndContext(noncePubkey, 'confirmed');

    if (!value) return null;
    if (!value.owner.equals(SystemProgram.programId)) return null;
    if (value.data.length < NONCE_ACCOUNT_LENGTH) return null;

    let state: NonceAccount;
    try {
        state = NonceAccount.fromAccountData(value.data);
    } catch {
        return null;
    }

    if (!state.authorizedPubkey.equals(expectedAuthority)) return null;

    return { nonce: state.nonce, minContextSlot: context.slot };
};

/**
 * Lists the required signers that are still missing a signature.
 *
 * A `VersionedTransaction` pre-fills `signatures` with 64 zero bytes per required
 * signer, so "unsigned" means "all bytes are zero" — not `undefined`.
 * Kept for diagnostics: it proves at a glance that the setup transaction has
 * exactly one required signer (the wallet).
 */
export const missingSigners = (tx: VersionedTransaction): string[] => {
    const required = tx.message.header.numRequiredSignatures;
    const keys = tx.message.staticAccountKeys;
    const missing: string[] = [];

    for (let i = 0; i < required; i += 1) {
        const sig = tx.signatures[i];
        if (!sig || sig.every((byte) => byte === 0)) {
            missing.push(keys[i]?.toBase58() ?? `#${i}`);
        }
    }

    return missing;
};

export type CreateNonceAccountResult = {
    transaction: VersionedTransaction;
    /** Deterministic address the nonce account will live at. */
    noncePubkey: PublicKey;
    blockhash: string;
    lastValidBlockHeight: number;
    minContextSlot: number;
    /** Rent-exempt deposit locked in the account (recoverable via nonceWithdraw). */
    lamports: number;
    /** Number of required signatures — must be 1 (the wallet). */
    requiredSigners: number;
};

/**
 * Builds the one-time setup transaction: allocate the seed-derived account, then
 * initialize it as a nonce account with the connected wallet as authority.
 *
 * The wallet is the ONLY signer. This transaction still uses a classic blockhash —
 * it is the only moment where speed matters, and it happens once.
 */
export const buildCreateNonceAccountTransaction = async ({
    connection,
    payer,
}: {
    connection: Connection;
    payer: PublicKey;
}): Promise<CreateNonceAccountResult> => {
    const noncePubkey = await deriveNonceAccount(payer);

    const lamports = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);

    const { context, value: latest } = await connection.getLatestBlockhashAndContext('confirmed');

    const instructions: TransactionInstruction[] = [
        SystemProgram.createAccountWithSeed({
            fromPubkey: payer,
            newAccountPubkey: noncePubkey,
            basePubkey: payer,
            seed: NONCE_SEED,
            lamports,
            space: NONCE_ACCOUNT_LENGTH,
            programId: SystemProgram.programId,
        }),
        SystemProgram.nonceInitialize({
            noncePubkey,
            authorizedPubkey: payer,
        }),
    ];

    const message = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: latest.blockhash,
        instructions,
    }).compileToV0Message();

    return {
        transaction: new VersionedTransaction(message),
        noncePubkey,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
        minContextSlot: context.slot,
        lamports,
        requiredSigners: message.header.numRequiredSignatures,
    };
};

/**
 * Builds a durable transaction.
 *
 * Two hard requirements, both enforced here:
 *  1. `recentBlockhash` is the nonce value, not a real blockhash.
 *  2. `nonceAdvance` is the FIRST instruction — the runtime rejects the
 *     transaction outright if anything precedes it.
 */
export const buildDurableNonceTransaction = ({
    payer,
    noncePubkey,
    nonceAuthority,
    nonceValue,
    instructions,
}: {
    payer: PublicKey;
    noncePubkey: PublicKey;
    nonceAuthority: PublicKey;
    nonceValue: string;
    instructions: TransactionInstruction[];
}): VersionedTransaction => {
    const message = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: nonceValue,
        instructions: [
            SystemProgram.nonceAdvance({
                noncePubkey,
                authorizedPubkey: nonceAuthority,
            }),
            ...instructions,
        ],
    }).compileToV0Message();

    return new VersionedTransaction(message);
};
