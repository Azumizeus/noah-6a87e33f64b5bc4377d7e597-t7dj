import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const Index = () => {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
            <header style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px' }}>
                <WalletMultiButton
                    style={{
                        backgroundColor: '#18181b',
                        color: '#ffffff',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '400',
                        height: '38px',
                        padding: '0 16px',
                    }}
                />
            </header>
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 400, color: '#3a3a3a', letterSpacing: '0.01em', textAlign: 'center' }}>
                    Start building your Solana app
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: 300, color: '#6b6b6b', textAlign: 'center' }}>
                    Connect your wallet to get started
                </p>
            </main>
        </div>
    );
};

export default Index;
