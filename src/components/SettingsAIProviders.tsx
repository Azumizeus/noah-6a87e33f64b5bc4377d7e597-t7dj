// src/components/SettingsAIProviders.tsx
//
// Coffre de cles IA — BYOK.
//
// L'utilisateur saisit sa propre cle. Elle est chiffree localement (AES-GCM,
// cle derivee d'une signature du wallet) et transmise uniquement au
// fournisseur choisi, en appel direct depuis le navigateur.
//
// Le texte affiche decrit exactement ce que fait le code. Toute reintroduction
// d'un relais serveur obligerait a reecrire ces phrases.

import { useState } from 'react';
import {
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAIKeyVault } from '@/hooks/useAIKeyVault';
import { usePassStatus } from '@/hooks/usePassStatus';
import { useWalletInfo } from '@/hooks/useWalletInfo';
import { callProvider, AIProviderError } from '@/lib/ai-providers/client';
import { PROVIDER_CONFIGS, PROVIDER_LIST } from '@/lib/ai-providers/config';
import type { AIProvider } from '@/lib/ai-providers/types';

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export function SettingsAIProviders() {
  const { toast } = useToast();
  const { connected } = useWalletInfo();
  const vault = useAIKeyVault();
  const pass = usePassStatus();

  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);

  const [testPrompt, setTestPrompt] = useState('');
  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState('');

  const config = PROVIDER_CONFIGS[provider];
  const hasKey = vault.records.some((record) => record.provider === provider);
  const gated = !pass.valid;

  const handleSave = async () => {
    const trimmed = apiKey.trim();

    if (!trimmed) {
      toast({ variant: 'destructive', title: 'Saisissez une cle API.' });
      return;
    }
    if (config.keyPrefix && !trimmed.startsWith(config.keyPrefix)) {
      toast({
        variant: 'destructive',
        title: 'Format inattendu',
        description: `Une cle ${config.label} commence normalement par ${config.keyPrefix}`,
      });
      return;
    }

    setSaving(true);
    try {
      await vault.saveKey(provider, trimmed, model);
      setApiKey('');
      setModel('');
      toast({
        title: 'Cle chiffree et enregistree',
        description: `${config.label} — stockage local uniquement.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Enregistrement impossible',
        description: error instanceof Error ? error.message : 'Erreur inconnue.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const prompt = testPrompt.trim();
    if (!prompt) {
      toast({ variant: 'destructive', title: 'Saisissez un message de test.' });
      return;
    }

    setTesting(true);
    setTestOutput('');

    try {
      // La cle est dechiffree ici et n'existe que le temps de l'appel.
      const key = await vault.revealKey(provider);
      const record = vault.records.find((r) => r.provider === provider);

      const response = await callProvider({
        provider,
        apiKey: key,
        model: record?.model,
        messages: [{ role: 'user', content: prompt }],
      });

      setTestOutput(response.content);
      toast({
        title: `${config.label} — reponse recue`,
        description: `${response.model} · ${response.latency} ms · ${response.tokens.output} tokens`,
      });
    } catch (error) {
      const message =
        error instanceof AIProviderError || error instanceof Error
          ? error.message
          : 'Erreur inconnue.';
      toast({ variant: 'destructive', title: 'Appel echoue', description: message });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = (target: AIProvider) => {
    vault.deleteKey(target);
    toast({ title: `${PROVIDER_CONFIGS[target].label} retire du coffre.` });
  };

  return (
    <section className="vault-surface space-y-7 rounded-[20px] border border-[hsl(var(--vault-hairline))] p-6 sm:p-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">Fournisseurs IA</h2>
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Vos cles sont chiffrees localement et ne sont jamais envoyees a nos
          serveurs. Elles sont transmises uniquement au fournisseur que vous
          avez choisi, en appel direct depuis ce navigateur.
        </p>
      </header>

      {/* --- Etat du Pass -------------------------------------------------- */}
      {gated && (
        <div className="rounded-[14px] border border-[hsl(var(--vault-hairline))] bg-muted/30 p-4 text-[13px] text-muted-foreground">
          {pass.loading
            ? 'Lecture du Pass on-chain…'
            : pass.exists
              ? 'Votre Pass a expire. Renouvelez-le pour utiliser les fonctions IA.'
              : 'Un Pass actif est requis pour utiliser les fonctions IA.'}
        </div>
      )}

      {/* --- Verrou du coffre ---------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[hsl(var(--vault-hairline))] bg-background/40 p-4">
        <div className="flex items-center gap-3">
          {vault.unlocked ? (
            <LockOpen className="size-4 text-primary" aria-hidden />
          ) : (
            <Lock className="size-4 text-muted-foreground" aria-hidden />
          )}
          <div>
            <p className="text-sm font-medium">
              {vault.unlocked ? 'Coffre ouvert' : 'Coffre verrouille'}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {vault.unlocked
                ? 'Cle de dechiffrement en memoire pour cette session.'
                : 'Signez un message pour deriver la cle. Ce n’est pas une transaction.'}
            </p>
          </div>
        </div>

        {vault.unlocked ? (
          <Button type="button" variant="secondary" onClick={vault.lock}>
            Verrouiller
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!connected || !vault.canSign || vault.unlocking}
            onClick={() => void vault.unlock()}
          >
            {vault.unlocking && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            Ouvrir le coffre
          </Button>
        )}
      </div>

      {!connected && (
        <p className="text-[13px] text-muted-foreground">
          Connectez un wallet pour creer ou ouvrir votre coffre.
        </p>
      )}
      {connected && !vault.canSign && (
        <p className="text-[13px] text-destructive">
          Ce wallet ne signe pas les messages hors transaction. Le coffre ne peut
          pas etre derive.
        </p>
      )}
      {vault.error && (
        <p aria-live="polite" className="text-[13px] text-destructive">
          {vault.error}
        </p>
      )}

      {/* --- Saisie -------------------------------------------------------- */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ai-provider">Fournisseur</Label>
          <Select
            value={provider}
            onValueChange={(value) => {
              setProvider(value as AIProvider);
              setTestOutput('');
            }}
          >
            <SelectTrigger id="ai-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_LIST.map((name) => (
                <SelectItem key={name} value={name}>
                  {PROVIDER_CONFIGS[name].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[12px] text-muted-foreground">
            Obtenir une cle :{' '}
            <a
              href={config.keysUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-4"
            >
              {new URL(config.keysUrl).host}
            </a>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-key">Cle API</Label>
          <Input
            id="ai-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            disabled={!vault.unlocked}
            placeholder={
              vault.unlocked
                ? config.keyPrefix
                  ? `${config.keyPrefix}…`
                  : 'Votre cle'
                : 'Ouvrez le coffre pour saisir une cle'
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-model">Modele (optionnel)</Label>
          <Input
            id="ai-model"
            spellCheck={false}
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={!vault.unlocked}
            placeholder={config.defaultModel}
          />
        </div>

        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={!vault.unlocked || saving}
          onClick={() => void handleSave()}
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          {hasKey ? 'Remplacer la cle' : 'Chiffrer et enregistrer'}
        </Button>
      </div>

      {/* --- Cles enregistrees --------------------------------------------- */}
      {vault.records.length > 0 && (
        <div className="space-y-3 border-t border-[hsl(var(--vault-hairline))] pt-6">
          <h3 className="text-sm font-semibold">Cles enregistrees</h3>
          <ul className="space-y-2">
            {vault.records.map((record) => (
              <li
                key={record.provider}
                className="flex items-center justify-between gap-4 rounded-[12px] border border-[hsl(var(--border))] bg-background/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {PROVIDER_CONFIGS[record.provider].label}
                  </p>
                  <p className="font-mono-vault truncate text-[12px] text-muted-foreground">
                    {record.model} · chiffree le {formatDate(record.savedAt)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(record.provider)}
                >
                  <Trash2 className="mr-1.5 size-4" aria-hidden />
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Test ----------------------------------------------------------- */}
      <div className="space-y-3 border-t border-[hsl(var(--vault-hairline))] pt-6">
        <h3 className="text-sm font-semibold">Tester le fournisseur</h3>
        <Textarea
          rows={3}
          value={testPrompt}
          onChange={(event) => setTestPrompt(event.target.value)}
          disabled={!vault.unlocked || !hasKey || gated}
          placeholder={
            gated
              ? 'Pass requis'
              : hasKey
                ? 'Votre message…'
                : 'Enregistrez d’abord une cle pour ce fournisseur'
          }
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!vault.unlocked || !hasKey || gated || testing}
          onClick={() => void handleTest()}
        >
          {testing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          Envoyer
        </Button>

        {testOutput && (
          <div className="whitespace-pre-wrap rounded-[12px] border border-[hsl(var(--border))] bg-background/60 p-4 text-[13px] leading-relaxed">
            {testOutput}
          </div>
        )}
      </div>

      {/* --- Note de securite ----------------------------------------------- */}
      <div className="flex gap-3 rounded-[12px] border border-[hsl(var(--vault-hairline))] bg-muted/30 p-4">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-primary/70"
          aria-hidden
        />
        <div className="space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
          <p>
            Chiffrement AES-256-GCM. La cle de dechiffrement est derivee d’une
            signature de votre wallet et n’est jamais stockee — sans ce wallet,
            le contenu du coffre est illisible.
          </p>
          <p>
            Le chiffrement protege le stockage sur disque. Il ne protege pas
            contre du code malveillant execute dans cette page pendant que le
            coffre est ouvert : verrouillez-le apres usage.
          </p>
          <p>
            Vous etes factures directement par le fournisseur, selon votre propre
            contrat avec lui.
          </p>
        </div>
      </div>
    </section>
  );
}

export default SettingsAIProviders;
