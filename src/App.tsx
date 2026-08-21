import { useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';
import { clusterApiUrl } from '@solana/web3.js';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import '@solana/wallet-adapter-react-ui/styles.css';

const App = () => {
  // RPC devnet dédié (Helius via VITE_SOLANA_RPC_URL) — le RPC public
  // clusterApiUrl('devnet') rate-limite agressivement (429 "Connection rate
  // limits exceeded"), surtout depuis un navigateur mobile où l'IP est
  // partagée par l'opérateur.
  const endpoint = useMemo(
    () => (import.meta.env.VITE_SOLANA_RPC_URL as string) || clusterApiUrl('devnet'),
    []
  );

  // ⚠️ Config identique à notre vrai projet BuildPact (frontend/src/App.tsx) :
  // - appIdentity.uri = window.location.origin, PAS une URL codée en dur
  //   (Vercel change l'URL à chaque déploiement, une URL figée casse l'autorisation MWA)
  // - chain: 'solana:devnet' (pas cluster: 'devnet')
  const wallets = useMemo(
    () => [
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: 'BuildPact Test',
          uri: typeof window !== 'undefined' ? window.location.origin : '',
          icon: '/favicon.ico',
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        chain: 'solana:devnet',
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{ commitment: 'confirmed', confirmTransactionInitialTimeout: 90_000 }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
