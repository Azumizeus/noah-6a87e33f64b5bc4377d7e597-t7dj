import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  address,
  createTransactionMessage,
  appendTransactionMessageInstruction,
  generateKeyPairSigner,
  lamports,
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";
import fs from "fs";
import path from "path";

describe("workspace", () => {
  const repoRoot = process.cwd();
  const idlPath = path.resolve(repoRoot, "target/idl/workspace.json");
  // ESM-safe IDL load — do NOT replace with require().
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl;
  const coder = new anchor.BorshCoder(idl);
  const programAddress = address((idl as any).address);

  const programSoPath = path.resolve(repoRoot, "target/deploy/workspace.so");
  const svm = new LiteSVM().withSysvars().withBuiltins();
  let feePayer: Awaited<ReturnType<typeof generateKeyPairSigner>>;

  before(async () => {
    if (!fs.existsSync(programSoPath)) {
      throw new Error(
        `Missing program binary at ${programSoPath}. Run \`anchor build\` first.`
      );
    }
    svm.addProgramFromFile(programAddress, programSoPath);

    feePayer = await generateKeyPairSigner();
    svm.airdrop(feePayer.address, lamports(1_000_000_000n));
  });

  it("Initializes and logs greeting", async () => {
    const data = coder.instruction.encode("initialize", {});
    const ix = {
      programAddress,
      accounts: [] as any[],
      data,
    };

    const msg = appendTransactionMessageInstruction(
      ix,
      setTransactionMessageFeePayerSigner(
        feePayer,
        createTransactionMessage({ version: 0 })
      )
    );
    const msgWithLifetime =
      svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg);
    const tx = await signTransactionMessageWithSigners(msgWithLifetime, {
      abortSignal: undefined,
    });
    const res = svm.sendTransaction(tx);

    if (res instanceof FailedTransactionMetadata) {
      throw new Error(res.meta().prettyLogs());
    }

    const logs = res.logs();
    expect(logs.some((log: string) => log.includes("Greetings from"))).to.equal(true);
  });
});