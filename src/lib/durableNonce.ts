import {
    Connection,
    Keypair,
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
 * after expiry and the cluster rejects it:
 *
 *   "La blockhash a expiré car trop de temps s'est écoulé entre la création et la
 *    signature de la transaction."
 *
 * A durable nonce removes the time limit entirely. Instead of a recent blockhash,
 * the transaction carries the value stored in an on-chain nonce account. That value
 * only changes when a `nonceAdvance` instruction runs — so the transaction stays
 * valid indefinitely, whether the user approves in 5 seconds or 5 minutes.
 *
 * Trade-off: strictly one durable transaction at a time per nonce account. The
 * first one to land advances the nonce and invalidates every other transaction
 * built on the same value.
 */

const STORAGE_PREFIX = 'solana:durable-nonce:';

const storageKey = (owner: PublicKey) => `${STORAGE_PREFIX}${owner.toBase58()}`;

/** Reads the nonce account address previously created for this wallet. */
export const getStoredNoncePubkey = (owner: PublicKey): PublicKey | null => {
    try {
        const raw = localStorage.getItem(storageKey(owner));
        return raw ? new PublicKey(raw) : null;
    } catch {
        return null;
    }
};

export const storeNoncePubkey = (owner: PublicKey, noncePubkey: PublicKey) => {
    try {
        localStorage.setItem(storageKey(owner), noncePubkey.toBase58());
    } catch {
        /* storage unavailable (private mode) — the nonce is simply recreated next time */
    }
};

export const clearStoredNonce = (owner: PublicKey) => {
    try {
        localStorage.removeItem(storageKey(owner));
    } catch {
        /* ignore */
    }
};

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
 * signer, so "unsigned" means "all bytes are zero" — not "undefined". This is the
 * cheapest way to prove, before sending, whether the local nonce keypair signature
 * actually survived the wallet round-trip.
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
    /** Must co-sign the creation transaction. Disposable afterwards. */
    nonceKeypair: Keypair;
    blockhash: string;
    lastValidBlockHeight: number;
    minContextSlot: number;
    /** Rent-exempt deposit locked in the account (recoverable via nonceWithdraw). */
    lamports: number;
};

/**
 * Builds the one-time setup transaction: create the account, then initialize it as
 * a nonce account with the connected wallet as authority.
 *
 * This single transaction still uses a classic blockhash — it is the only moment
 * where speed matters, and it is a one-off.
 */
export const buildCreateNonceAccountTransaction = async ({
    connection,
    payer,
}: {
    connection: Connection;
    payer: PublicKey;
}): Promise<CreateNonceAccountResult> => {
    const nonceKeypair = Keypair.generate();

    const lamports = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);

    const { context, value: latest } = await connection.getLatestBlockhashAndContext('confirmed');

    const instructions: TransactionInstruction[] = [
        SystemProgram.createAccount({
            fromPubkey: payer,
            newAccountPubkey: nonceKeypair.publicKey,
            lamports,
            space: NONCE_ACCOUNT_LENGTH,
            programId: SystemProgram.programId,
        }),
        SystemProgram.nonceInitialize({
            noncePubkey: nonceKeypair.publicKey,
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
        nonceKeypair,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
        minContextSlot: context.slot,
        lamports,
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
