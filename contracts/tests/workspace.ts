import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressCodec,
  getProgramDerivedAddress,
  lamports,
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import type { Address } from "@solana/kit";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";
import fs from "fs";
import path from "path";

const BN = anchor.BN;

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const SENTINEL_DURATION = 604_800;
const ORACLE_DURATION = 2_592_000;

const TIER0_PRICE_LAMPORTS = 50_000_000n;
const TIER1_PRICE_LAMPORTS = 150_000_000n;
const TIER0_PRICE_TOKEN = 5_000_000n;
const TIER1_PRICE_TOKEN = 15_000_000n;

const addressCodec = getAddressCodec();
const enc = (s: string) => new TextEncoder().encode(s);

type Signer = Awaited<ReturnType<typeof generateKeyPairSigner>>;

describe("access_gate", () => {
  const repoRoot = process.cwd();
  const idlPath = path.resolve(repoRoot, "target/idl/workspace.json");
  // ESM-safe IDL load — do NOT replace with require().
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl;
  const coder = new anchor.BorshCoder(idl);
  const programAddress = address((idl as any).address);
  const programSoPath = path.resolve(repoRoot, "target/deploy/workspace.so");

  let svm: LiteSVM;

  let authority: Signer;
  let attacker: Signer;
  let buyer1: Signer;
  let buyer2: Signer;
  let buyer3: Signer;
  let buyer4: Signer;
  let buyer5: Signer;
  let buyer6: Signer;

  let treasury: Address;
  let configPda: Address;

  // token fixtures
  let mintA: Address; // whitelisted
  let mintB: Address; // never whitelisted
  let treasuryAtaA: Address;
  let treasuryAtaB: Address;
  let buyer5AtaA: Address;
  let buyer6AtaA: Address;
  let buyer4AtaB: Address;
  let paymentMintAPda: Address;
  let paymentMintBPda: Address;

  // ---------------------------------------------------------------- helpers

  function now(): number {
    return Number(svm.getClock().unixTimestamp);
  }

  function advanceClock(seconds: number) {
    const clock = svm.getClock();
    clock.unixTimestamp = clock.unixTimestamp + BigInt(seconds);
    svm.setClock(clock);
  }

  function ix(accounts: Array<{ address: Address; role: any }>, data: Buffer) {
    return { programAddress, accounts, data: new Uint8Array(data) };
  }

  async function buildTx(instruction: any, feePayer: Signer) {
    const msg = appendTransactionMessageInstruction(
      instruction,
      setTransactionMessageFeePayerSigner(
        feePayer,
        createTransactionMessage({ version: 0 })
      )
    );
    const msgWithLifetime =
      svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg);
    return signTransactionMessageWithSigners(msgWithLifetime, {
      abortSignal: undefined,
    });
  }

  async function sendIx(instruction: any, feePayer: Signer) {
    const tx = await buildTx(instruction, feePayer);
    const res = svm.sendTransaction(tx);
    if (res instanceof FailedTransactionMetadata) {
      throw new Error(res.meta().prettyLogs());
    }
    return res;
  }

  async function expectFailure(
    instruction: any,
    feePayer: Signer,
    includes: string
  ) {
    const tx = await buildTx(instruction, feePayer);
    const res = svm.simulateTransaction(tx);
    expect(res, "expected transaction to fail").to.be.instanceOf(
      FailedTransactionMetadata
    );
    const logText = (res as FailedTransactionMetadata)
      .meta()
      .logs()
      .join("\n");
    expect(logText).to.include(includes);
  }

  function getAccountData(addr: Address): Uint8Array | null {
    const acc = svm.getAccount(addr) as any;
    if (!acc || acc.exists === false) return null;
    const data = acc.data as Uint8Array;
    if (!data || data.length === 0) return null;
    return Uint8Array.from(data);
  }

  function decodeAccount<T = any>(name: string, addr: Address): T {
    const data = getAccountData(addr);
    if (!data) throw new Error(`Missing account ${name} at ${addr}`);
    return coder.accounts.decode(name, Buffer.from(data)) as T;
  }

  function toAddressString(value: any): string {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array) return addressCodec.decode(value);
    if (value && typeof value.toBase58 === "function") return value.toBase58();
    if (value && typeof value.length === "number") {
      return addressCodec.decode(Uint8Array.from(value));
    }
    throw new Error("Unable to decode address");
  }

  // --- SPL token fixtures written directly into the SVM ---------------------

  function encodeMintData(decimals: number, mintAuthority: Address): Uint8Array {
    const data = new Uint8Array(82);
    const view = new DataView(data.buffer);
    view.setUint32(0, 1, true); // mint_authority: Some
    data.set(addressCodec.encode(mintAuthority), 4);
    view.setBigUint64(36, 1_000_000_000_000n, true); // supply
    data[44] = decimals;
    data[45] = 1; // is_initialized
    view.setUint32(46, 0, true); // freeze_authority: None
    return data;
  }

  function encodeTokenAccountData(
    mint: Address,
    owner: Address,
    amount: bigint
  ): Uint8Array {
    const data = new Uint8Array(165);
    const view = new DataView(data.buffer);
    data.set(addressCodec.encode(mint), 0);
    data.set(addressCodec.encode(owner), 32);
    view.setBigUint64(64, amount, true);
    view.setUint32(72, 0, true); // delegate: None
    data[108] = 1; // AccountState::Initialized
    view.setUint32(109, 0, true); // is_native: None
    view.setBigUint64(121, 0n, true); // delegated_amount
    view.setUint32(129, 0, true); // close_authority: None
    return data;
  }

  function putAccount(addr: Address, data: Uint8Array) {
    svm.setAccount({
      address: addr,
      lamports: lamports(10_000_000n),
      data,
      programAddress: TOKEN_PROGRAM,
      executable: false,
      space: BigInt(data.length),
    } as any);
  }

  function tokenBalance(addr: Address): bigint {
    const data = getAccountData(addr);
    if (!data) throw new Error(`Missing token account ${addr}`);
    return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(
      64,
      true
    );
  }

  // --- instruction builders ------------------------------------------------

  function initializeConfigIx(auth: Signer, cfg: Address, treasuryAddr: Address) {
    const data = coder.instruction.encode("initialize_config", {
      treasury: new PublicKey(treasuryAddr),
      tier0_price_lamports: new BN(TIER0_PRICE_LAMPORTS.toString()),
      tier0_price_token: new BN(TIER0_PRICE_TOKEN.toString()),
      tier1_price_lamports: new BN(TIER1_PRICE_LAMPORTS.toString()),
      tier1_price_token: new BN(TIER1_PRICE_TOKEN.toString()),
    });
    return ix(
      [
        { address: cfg, role: AccountRole.WRITABLE },
        { address: auth.address, role: AccountRole.WRITABLE_SIGNER },
        { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
      ],
      data
    );
  }

  function updateConfigIx(
    auth: Signer,
    cfg: Address,
    treasuryOpt: Address | null,
    pausedOpt: boolean | null
  ) {
    const data = coder.instruction.encode("update_config", {
      treasury: treasuryOpt === null ? null : new PublicKey(treasuryOpt),
      paused: pausedOpt,
    });
    return ix(
      [
        { address: cfg, role: AccountRole.WRITABLE },
        { address: auth.address, role: AccountRole.READONLY_SIGNER },
      ],
      data
    );
  }

  function addPaymentMintIx(
    auth: Signer,
    cfg: Address,
    mint: Address,
    treasuryAta: Address,
    paymentMint: Address,
    decimals: number
  ) {
    const data = coder.instruction.encode("add_payment_mint", { decimals });
    return ix(
      [
        { address: cfg, role: AccountRole.READONLY },
        { address: auth.address, role: AccountRole.WRITABLE_SIGNER },
        { address: mint, role: AccountRole.READONLY },
        { address: treasuryAta, role: AccountRole.READONLY },
        { address: paymentMint, role: AccountRole.WRITABLE },
        { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
      ],
      data
    );
  }

  function setPaymentMintActiveIx(
    auth: Signer,
    cfg: Address,
    mint: Address,
    paymentMint: Address,
    active: boolean
  ) {
    const data = coder.instruction.encode("set_payment_mint_active", { active });
    return ix(
      [
        { address: cfg, role: AccountRole.READONLY },
        { address: auth.address, role: AccountRole.READONLY_SIGNER },
        { address: mint, role: AccountRole.READONLY },
        { address: paymentMint, role: AccountRole.WRITABLE },
      ],
      data
    );
  }

  function purchaseSolIx(
    buyer: Signer,
    cfg: Address,
    treasuryAddr: Address,
    pass: Address,
    tier: number
  ) {
    const data = coder.instruction.encode("purchase_pass_sol", { tier });
    return ix(
      [
        { address: cfg, role: AccountRole.READONLY },
        { address: buyer.address, role: AccountRole.WRITABLE_SIGNER },
        { address: treasuryAddr, role: AccountRole.WRITABLE },
        { address: pass, role: AccountRole.WRITABLE },
        { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
      ],
      data
    );
  }

  function purchaseTokenIx(
    buyer: Signer,
    cfg: Address,
    buyerAta: Address,
    paymentMint: Address,
    treasuryAta: Address,
    pass: Address,
    tier: number
  ) {
    const data = coder.instruction.encode("purchase_pass_token", { tier });
    return ix(
      [
        { address: cfg, role: AccountRole.READONLY },
        { address: buyer.address, role: AccountRole.WRITABLE_SIGNER },
        { address: buyerAta, role: AccountRole.WRITABLE },
        { address: paymentMint, role: AccountRole.READONLY },
        { address: treasuryAta, role: AccountRole.WRITABLE },
        { address: pass, role: AccountRole.WRITABLE },
        { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
        { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
      ],
      data
    );
  }

  function closePassIx(owner: Signer, pass: Address) {
    const data = coder.instruction.encode("close_pass", {});
    return ix(
      [
        { address: pass, role: AccountRole.WRITABLE },
        { address: owner.address, role: AccountRole.WRITABLE_SIGNER },
      ],
      data
    );
  }

  async function passPda(owner: Address): Promise<Address> {
    const [pda] = await getProgramDerivedAddress({
      programAddress,
      seeds: [enc("pass"), addressCodec.encode(owner)],
    });
    return pda;
  }

  async function mintPda(mint: Address): Promise<Address> {
    const [pda] = await getProgramDerivedAddress({
      programAddress,
      seeds: [enc("mint"), addressCodec.encode(mint)],
    });
    return pda;
  }

  // ------------------------------------------------------------------ setup

  before(async () => {
    if (!fs.existsSync(programSoPath)) {
      throw new Error(
        `Missing program binary at ${programSoPath}. Run \`anchor build\` first.`
      );
    }

    svm = new LiteSVM()
      .withSysvars()
      .withBuiltins()
      .withDefaultPrograms()
      .withTransactionHistory(0n)
      .withLogBytesLimit(256n * 1024n);
    svm.addProgramFromFile(programAddress, programSoPath);

    const clock = svm.getClock();
    clock.unixTimestamp = BigInt(Math.floor(Date.now() / 1000));
    svm.setClock(clock);

    [authority, attacker, buyer1, buyer2, buyer3, buyer4, buyer5, buyer6] =
      await Promise.all([
        generateKeyPairSigner(),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
      ]);

    for (const s of [
      authority,
      attacker,
      buyer1,
      buyer2,
      buyer3,
      buyer4,
      buyer5,
      buyer6,
    ]) {
      svm.airdrop(s.address, lamports(100n * 1_000_000_000n));
    }

    const treasurySigner = await generateKeyPairSigner();
    treasury = treasurySigner.address;
    svm.airdrop(treasury, lamports(1_000_000_000n));

    [configPda] = await getProgramDerivedAddress({
      programAddress,
      seeds: [enc("config"), addressCodec.encode(authority.address)],
    });

    // Local SPL fixtures
    const mintASigner = await generateKeyPairSigner();
    const mintBSigner = await generateKeyPairSigner();
    const treasuryAtaASigner = await generateKeyPairSigner();
    const treasuryAtaBSigner = await generateKeyPairSigner();
    const buyer5AtaSigner = await generateKeyPairSigner();
    const buyer6AtaSigner = await generateKeyPairSigner();
    const buyer4AtaSigner = await generateKeyPairSigner();

    mintA = mintASigner.address;
    mintB = mintBSigner.address;
    treasuryAtaA = treasuryAtaASigner.address;
    treasuryAtaB = treasuryAtaBSigner.address;
    buyer5AtaA = buyer5AtaSigner.address;
    buyer6AtaA = buyer6AtaSigner.address;
    buyer4AtaB = buyer4AtaSigner.address;

    putAccount(mintA, encodeMintData(6, authority.address));
    putAccount(mintB, encodeMintData(6, authority.address));
    putAccount(treasuryAtaA, encodeTokenAccountData(mintA, treasury, 0n));
    putAccount(treasuryAtaB, encodeTokenAccountData(mintB, treasury, 0n));
    putAccount(
      buyer5AtaA,
      encodeTokenAccountData(mintA, buyer5.address, 100_000_000n)
    );
    putAccount(
      buyer6AtaA,
      encodeTokenAccountData(mintA, buyer6.address, 100_000_000n)
    );
    putAccount(
      buyer4AtaB,
      encodeTokenAccountData(mintB, buyer4.address, 100_000_000n)
    );

    paymentMintAPda = await mintPda(mintA);
    paymentMintBPda = await mintPda(mintB);
  });

  // ------------------------------------------------------------------ tests

  it("1. initialize_config sets authority, treasury and both tier durations", async () => {
    await sendIx(initializeConfigIx(authority, configPda, treasury), authority);

    const config = decodeAccount("Config", configPda);
    expect(toAddressString(config.authority)).to.equal(authority.address);
    expect(toAddressString(config.treasury)).to.equal(treasury);
    expect(config.is_active).to.equal(true);
    expect(config.is_paused).to.equal(false);
    expect(Number(config.version)).to.equal(1);
    expect(Number(config.tier_count)).to.equal(2);

    expect(Number(config.tiers[0].duration_seconds)).to.equal(SENTINEL_DURATION);
    expect(config.tiers[0].price_lamports.toString()).to.equal(
      TIER0_PRICE_LAMPORTS.toString()
    );
    expect(config.tiers[0].price_token_base_units.toString()).to.equal(
      TIER0_PRICE_TOKEN.toString()
    );
    expect(config.tiers[0].active).to.equal(true);

    expect(Number(config.tiers[1].duration_seconds)).to.equal(ORACLE_DURATION);
    expect(config.tiers[1].price_lamports.toString()).to.equal(
      TIER1_PRICE_LAMPORTS.toString()
    );
    expect(config.tiers[1].price_token_base_units.toString()).to.equal(
      TIER1_PRICE_TOKEN.toString()
    );
    expect(config.tiers[1].active).to.equal(true);
  });

  it("2. purchase_pass_sol tier 0 creates a 7-day pass and moves lamports to treasury", async () => {
    const pass = await passPda(buyer1.address);
    const before = svm.getBalance(treasury) as bigint;
    const t = now();

    await sendIx(
      purchaseSolIx(buyer1, configPda, treasury, pass, 0),
      buyer1
    );

    const after = svm.getBalance(treasury) as bigint;
    expect(after - before).to.equal(TIER0_PRICE_LAMPORTS);

    const acc = decodeAccount("Pass", pass);
    expect(toAddressString(acc.owner)).to.equal(buyer1.address);
    expect(toAddressString(acc.config)).to.equal(configPda);
    expect(Number(acc.tier)).to.equal(0);
    expect(Number(acc.total_purchases)).to.equal(1);
    const delta = Number(acc.expires_at) - (t + SENTINEL_DURATION);
    expect(Math.abs(delta)).to.be.lessThan(5);
  });

  it("3. purchase_pass_sol tier 1 creates a 30-day pass", async () => {
    const pass = await passPda(buyer2.address);
    const before = svm.getBalance(treasury) as bigint;
    const t = now();

    await sendIx(
      purchaseSolIx(buyer2, configPda, treasury, pass, 1),
      buyer2
    );

    const after = svm.getBalance(treasury) as bigint;
    expect(after - before).to.equal(TIER1_PRICE_LAMPORTS);

    const acc = decodeAccount("Pass", pass);
    expect(Number(acc.tier)).to.equal(1);
    expect(Number(acc.total_purchases)).to.equal(1);
    const delta = Number(acc.expires_at) - (t + ORACLE_DURATION);
    expect(Math.abs(delta)).to.be.lessThan(5);
  });

  it("4. renewal while still valid extends expires_at instead of resetting", async () => {
    const pass = await passPda(buyer1.address);
    const previous = Number(decodeAccount("Pass", pass).expires_at);

    advanceClock(3600);

    await sendIx(
      purchaseSolIx(buyer1, configPda, treasury, pass, 0),
      buyer1
    );

    const acc = decodeAccount("Pass", pass);
    expect(Number(acc.total_purchases)).to.equal(2);
    expect(Number(acc.expires_at)).to.equal(previous + SENTINEL_DURATION);
    expect(Number(acc.expires_at)).to.be.greaterThan(now() + SENTINEL_DURATION);
  });

  it("5. purchase_pass_sol with a wrong treasury account fails", async () => {
    const pass = await passPda(buyer3.address);
    await expectFailure(
      purchaseSolIx(buyer3, configPda, buyer3.address, pass, 0),
      buyer3,
      "InvalidTreasury"
    );
  });

  it("6. purchase_pass_sol with an invalid tier index fails with InvalidTier", async () => {
    const pass = await passPda(buyer3.address);
    await expectFailure(
      purchaseSolIx(buyer3, configPda, treasury, pass, 5),
      buyer3,
      "InvalidTier"
    );
  });

  it("7. purchase_pass_token with a non-whitelisted mint fails", async () => {
    const pass = await passPda(buyer4.address);
    await expectFailure(
      purchaseTokenIx(
        buyer4,
        configPda,
        buyer4AtaB,
        paymentMintBPda,
        treasuryAtaB,
        pass,
        0
      ),
      buyer4,
      "AccountNotInitialized"
    );
  });

  it("8. add_payment_mint whitelists a mint and purchase_pass_token moves tokens to the treasury ATA", async () => {
    await sendIx(
      addPaymentMintIx(
        authority,
        configPda,
        mintA,
        treasuryAtaA,
        paymentMintAPda,
        6
      ),
      authority
    );

    const pm = decodeAccount("PaymentMint", paymentMintAPda);
    expect(toAddressString(pm.config)).to.equal(configPda);
    expect(toAddressString(pm.mint)).to.equal(mintA);
    expect(toAddressString(pm.treasury_ata)).to.equal(treasuryAtaA);
    expect(Number(pm.decimals)).to.equal(6);
    expect(pm.active).to.equal(true);

    const pass = await passPda(buyer5.address);
    const treasuryBefore = tokenBalance(treasuryAtaA);
    const buyerBefore = tokenBalance(buyer5AtaA);
    const t = now();

    await sendIx(
      purchaseTokenIx(
        buyer5,
        configPda,
        buyer5AtaA,
        paymentMintAPda,
        treasuryAtaA,
        pass,
        0
      ),
      buyer5
    );

    expect(tokenBalance(treasuryAtaA) - treasuryBefore).to.equal(
      TIER0_PRICE_TOKEN
    );
    expect(buyerBefore - tokenBalance(buyer5AtaA)).to.equal(TIER0_PRICE_TOKEN);

    const acc = decodeAccount("Pass", pass);
    expect(toAddressString(acc.owner)).to.equal(buyer5.address);
    expect(Number(acc.total_purchases)).to.equal(1);
    const delta = Number(acc.expires_at) - (t + SENTINEL_DURATION);
    expect(Math.abs(delta)).to.be.lessThan(5);
  });

  it("9. purchase_pass_token with a deactivated mint fails", async () => {
    await sendIx(
      setPaymentMintActiveIx(
        authority,
        configPda,
        mintA,
        paymentMintAPda,
        false
      ),
      authority
    );
    expect(decodeAccount("PaymentMint", paymentMintAPda).active).to.equal(false);

    const pass = await passPda(buyer6.address);
    await expectFailure(
      purchaseTokenIx(
        buyer6,
        configPda,
        buyer6AtaA,
        paymentMintAPda,
        treasuryAtaA,
        pass,
        0
      ),
      buyer6,
      "MintInactive"
    );

    await sendIx(
      setPaymentMintActiveIx(authority, configPda, mintA, paymentMintAPda, true),
      authority
    );
    expect(decodeAccount("PaymentMint", paymentMintAPda).active).to.equal(true);
  });

  it("10. update_config by a non-authority signer fails", async () => {
    await expectFailure(
      updateConfigIx(attacker, configPda, attacker.address, null),
      attacker,
      "ConstraintSeeds"
    );

    const config = decodeAccount("Config", configPda);
    expect(toAddressString(config.treasury)).to.equal(treasury);
  });

  it("11. purchasing while paused fails", async () => {
    await sendIx(updateConfigIx(authority, configPda, null, true), authority);
    expect(decodeAccount("Config", configPda).is_paused).to.equal(true);

    const pass = await passPda(buyer3.address);
    await expectFailure(
      purchaseSolIx(buyer3, configPda, treasury, pass, 0),
      buyer3,
      "Paused"
    );

    await sendIx(updateConfigIx(authority, configPda, null, false), authority);
    expect(decodeAccount("Config", configPda).is_paused).to.equal(false);
  });

  it("12. close_pass before expiry fails with PassStillActive", async () => {
    const pass = await passPda(buyer1.address);
    await expectFailure(closePassIx(buyer1, pass), buyer1, "PassStillActive");
    expect(getAccountData(pass)).to.not.equal(null);
  });

  it("13. close_pass after expiry refunds rent to the owner", async () => {
    const pass = await passPda(buyer1.address);
    const expiresAt = Number(decodeAccount("Pass", pass).expires_at);
    advanceClock(expiresAt - now() + 10);

    const balanceBefore = svm.getBalance(buyer1.address) as bigint;
    await sendIx(closePassIx(buyer1, pass), buyer1);
    const balanceAfter = svm.getBalance(buyer1.address) as bigint;

    expect(getAccountData(pass)).to.equal(null);
    expect(balanceAfter > balanceBefore).to.equal(true);
  });
});
