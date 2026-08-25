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
import { RPC_ENDPOINT, RPC_HEADERS } from '@/lib/solana';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Pass from './pages/Pass';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import '@solana/wallet-adapter-react-ui/styles.css';

const App = () => {
  // RPC via l'Edge Function `rpc-proxy`. La clé Helius reste côté serveur :
  // toute variable VITE_ finit en clair dans le bundle public.
  const endpoint = useMemo(() => RPC_ENDPOINT, []);

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
      config={{
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 90_000,
        httpHeaders: RPC_HEADERS,
      }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pass" element={<Pass />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            {/* Ancienne page de demo Seed Vault — conservee, hors Layout. */}
            <Route path="/demo" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
