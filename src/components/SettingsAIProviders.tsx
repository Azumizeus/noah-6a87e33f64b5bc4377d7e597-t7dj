// src/components/SettingsAIProviders.tsx
//
// Panneau de configuration du relais IA — UI ONLY.
// Aucune saisie de cle API : le navigateur ne manipule que l'URL du proxy.

import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

import { aiClient } from '@/lib/ai-providers/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type TestState = 'idle' | 'testing' | 'ok' | 'failed';

const ENV_PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL as string) ?? '';

export function SettingsAIProviders() {
  const [proxyUrl, setProxyUrl] = useState(ENV_PROXY_URL);
  const [saved, setSaved] = useState(Boolean(ENV_PROXY_URL));
  const [state, setState] = useState<TestState>('idle');
  const [message, setMessage] = useState('');

  const handleSetProxy = () => {
    const url = proxyUrl.trim();
    if (!url) {
      setState('failed');
      setMessage('URL du relais requise.');
      return;
    }

    aiClient.setProxyBaseUrl(url);
    setSaved(true);
    setState('idle');
    setMessage('Relais enregistre pour cette session.');
  };

  const handleTestProxy = async () => {
    setState('testing');
    setMessage('');

    try {
      const response = await aiClient.call({
        provider: 'anthropic',
        prompt: 'Respond with a single word: OK.',
      });
      setState('ok');
      setMessage(
        `Relais operationnel — ${response.provider}, ${response.latency} ms.`,
      );
    } catch (error) {
      setState('failed');
      setMessage(
        error instanceof Error ? error.message : 'Erreur inconnue.',
      );
    }
  };

  return (
    <section className="space-y-6 rounded-lg border border-border bg-card p-6">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Relais IA
        </h3>
        <p className="text-sm text-muted-foreground">
          Les cles des fournisseurs sont detenues et dechiffrees uniquement par
          la fonction serveur. Le navigateur ne les voit jamais.
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="ai-proxy-url">
          URL de la fonction Supabase
        </Label>
        <Input
          id="ai-proxy-url"
          type="url"
          inputMode="url"
          spellCheck={false}
          value={proxyUrl}
          onChange={(event) => {
            setProxyUrl(event.target.value);
            setSaved(false);
            setState('idle');
          }}
          placeholder="https://<project>.supabase.co/functions/v1/ai-proxy"
        />
        <p className="text-xs text-muted-foreground">
          Valeur par defaut lue depuis <code>VITE_AI_PROXY_URL</code>.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={handleSetProxy}>
          Enregistrer le relais
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!saved || state === 'testing'}
          onClick={() => void handleTestProxy()}
        >
          {state === 'testing' && (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          )}
          Tester la connexion
        </Button>
      </div>

      <p
        aria-live="polite"
        className={`min-h-5 text-xs ${
          state === 'failed' ? 'text-destructive' : 'text-muted-foreground'
        }`}
      >
        {message}
      </p>

      <div className="flex gap-3 rounded-md border border-border bg-muted/40 p-4">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Implementation serveur :{' '}
            <code>supabase/functions/ai-proxy/index.ts</code>.
          </p>
          <p>Outil d&apos;analyse, pas un conseil en investissement.</p>
        </div>
      </div>
    </section>
  );
}
