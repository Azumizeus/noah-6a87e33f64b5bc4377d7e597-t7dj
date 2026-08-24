// src/hooks/useWalletInfo.ts
//
// Enveloppe du wallet-adapter. Nomme `useWalletInfo` et non `useWallet` :
// un hook local homonyme de celui de @solana/wallet-adapter-react rend les
// imports ambigus et provoque des bugs silencieux difficiles a tracer.

import { useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

const shorten = (address: string) =>
    `${address.slice(0, 4)}…${address.slice(-4)}`;

export interface WalletInfo {
    connected: boolean;
    connecting: boolean;
    /** Adresse publique base58, chaine vide si deconnecte. */
    address: string;
    shortAddress: string;
    walletName: string | null;
    disconnect: () => Promise<void>;
}

export const useWalletInfo = (): WalletInfo => {
    const { publicKey, connected, connecting, disconnect, wallet } = useWallet();

    const address = useMemo(() => publicKey?.toBase58() ?? '', [publicKey]);

    return {
        connected,
        connecting,
        address,
        shortAddress: address ? shorten(address) : '',
        walletName: wallet?.adapter.name ?? null,
        disconnect,
    };
};

export default useWalletInfo;
