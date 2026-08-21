import { useCallback, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, Copy, LogOut, Repeat, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const shorten = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

const WalletButton = () => {
    const { publicKey, connected, connecting, disconnect, wallet } = useWallet();
    const { setVisible } = useWalletModal();
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const address = useMemo(() => publicKey?.toBase58() ?? '', [publicKey]);

    const copyAddress = useCallback(async () => {
        if (!address) return;
        await navigator.clipboard.writeText(address);
        setCopied(true);
        toast({ title: 'Adresse copiée', description: shorten(address) });
        setTimeout(() => setCopied(false), 1600);
    }, [address, toast]);

    if (!connected) {
        return (
            <button
                onClick={() => setVisible(true)}
                disabled={connecting}
                className="group inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 disabled:opacity-60"
                style={{ boxShadow: 'var(--glow-gold)' }}
            >
                <Wallet className="h-4 w-4" />
                {connecting ? 'Connexion…' : 'Connecter le wallet'}
            </button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="inline-flex h-11 items-center gap-2.5 rounded-full border border-[hsl(var(--vault-hairline))] bg-[hsl(var(--vault-elevated))] px-4 text-sm text-foreground transition-colors duration-300 hover:border-primary/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
                    {wallet?.adapter.icon && (
                        <img src={wallet.adapter.icon} alt="" className="h-4 w-4 rounded" />
                    )}
                    <span className="font-mono-vault text-[13px] tracking-tight">{shorten(address)}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl border-[hsl(var(--vault-hairline))] bg-card"
            >
                <DropdownMenuItem onClick={copyAddress} className="cursor-pointer gap-2 text-sm">
                    {copied ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                    Copier l'adresse
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVisible(true)} className="cursor-pointer gap-2 text-sm">
                    <Repeat className="h-4 w-4" />
                    Changer de wallet
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => disconnect()}
                    className="cursor-pointer gap-2 text-sm text-destructive focus:text-destructive"
                >
                    <LogOut className="h-4 w-4" />
                    Déconnecter
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default WalletButton;
