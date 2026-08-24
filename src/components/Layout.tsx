// src/components/Layout.tsx
//
// Coquille globale : en-tete, navigation, zone de contenu.
// Le bouton wallet reste en haut a droite, sur toutes les tailles d'ecran.

import { NavLink, Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import WalletButton from '@/components/WalletButton';
import LocaleSelector from '@/components/LocaleSelector';

const NAV_ITEMS = [
    { to: '/', key: 'nav.dashboard', end: true },
    { to: '/pass', key: 'nav.pass', end: false },
    { to: '/settings', key: 'nav.settings', end: false },
] as const;

const Layout = () => {
    const { t } = useTranslation();

    return (
        <div className="relative min-h-screen bg-background text-foreground">
            {/* Atmosphere */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0"
                style={{
                    background:
                        'radial-gradient(70% 55% at 78% -5%, hsl(38 88% 58% / 0.12), transparent 60%), radial-gradient(60% 50% at 8% 100%, hsl(30 40% 30% / 0.16), transparent 65%)',
                }}
            />

            <header className="relative z-10 border-b border-[hsl(var(--vault-hairline))] backdrop-blur-sm">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
                    <div className="flex items-center gap-8">
                        <Link
                            to="/"
                            className="font-display text-sm tracking-[0.24em] text-foreground transition-colors duration-300 hover:text-primary"
                        >
                            SEEKER I
                        </Link>

                        <nav className="hidden gap-7 sm:flex" aria-label="Navigation principale">
                            {NAV_ITEMS.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        `text-[13px] transition-colors duration-300 ${
                                            isActive
                                                ? 'text-primary'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`
                                    }
                                >
                                    {t(item.key)}
                                </NavLink>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        <LocaleSelector />
                        <WalletButton />
                    </div>
                </div>

                {/* Navigation mobile */}
                <nav
                    className="flex gap-6 border-t border-[hsl(var(--vault-hairline))] px-5 py-3 sm:hidden"
                    aria-label="Navigation principale"
                >
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                                `text-[13px] transition-colors duration-300 ${
                                    isActive
                                        ? 'text-primary'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`
                            }
                        >
                            {t(item.key)}
                        </NavLink>
                    ))}
                </nav>
            </header>

            <main className="relative z-10 mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
                <Outlet />
            </main>

            <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-10 sm:px-8">
                <p className="text-[12px] text-muted-foreground">
                    {t('common.disclaimer')}
                </p>
            </footer>
        </div>
    );
};

export default Layout;
