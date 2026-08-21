import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';
import { mwaAuthCache } from './lib/mwaAuthCache';
import { RPC_ENDPOINT } from './lib/constants';
import { useHashRoute } from './lib/router';
import DashboardPage from './pages/DashboardPage';
import PactsPage from './pages/PactsPage';
import TreasuryPage from './pages/TreasuryPage';
import DocsPage from './pages/DocsPage';

import '@solana/wallet-adapter-react-ui/styles.css';

// ⚠️ REVERT volontaire vers SolanaMobileWalletAdapter (package legacy) après
// une tentative de migration vers registerMwa (package "recommandé") qui a
// dégradé la fiabilité au lieu de l'améliorer. C'est CETTE configuration
// exacte (SolanaMobileWalletAdapter + VersionedTransaction dans anchor.ts)
// qui a produit 2 signatures réussies d'affilée sur Seed Vault natif. On ne
// change plus rien ici tant que ce n'est pas retesté et confirmé stable.
//
// ⚠️ FIX appIdentity.uri : cette valeur était codée en dur sur une ANCIENNE
// URL de déploiement Vercel (buildpact-9y9o4gx0g-...). Or Vercel génère une
// URL différente à CHAQUE déploiement — on en a eu au moins 6 différentes
// pendant cette session. Une identité d'app qui ne correspond pas à l'origine
// réelle de la page peut perturber l'autorisation MWA de façon incohérente.
// On utilise maintenant window.location.origin, qui s'adapte automatiquement.
// Aussi aligné sur `chain: 'solana:devnet'` (équivalent à cluster: 'devnet'
// en interne, mais c'est la forme qui a été confirmée fonctionner ailleurs).
export default function App() {
  const wallets = useMemo(
    () => [
      // ⭐ MWA — Seed Vault / Seeker (critère hackathon)
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: 'BuildPact',
          uri: typeof window !== 'undefined' ? window.location.origin : '',
          icon: '/favicon.ico',
        },
        authorizationResultCache: mwaAuthCache,
        chain: 'solana:devnet',
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );
  const route = useHashRoute();

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {route === '/pacts' ? (
            <PactsPage />
          ) : route === '/treasury' ? (
            <TreasuryPage />
          ) : route === '/docs' ? (
            <DocsPage />
          ) : (
            <DashboardPage />
          )}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
