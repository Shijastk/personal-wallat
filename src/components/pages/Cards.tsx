import { useEffect, useState, useRef } from 'react';
import { CreditCard, Plus, Star, Trash2, Eye, EyeOff, Lock, Unlock, Copy, Check, Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn, maskCardNumber } from '@/lib/utils';
import { hasSessionKey, encryptWithSession, decryptWithSession } from '@/lib/crypto';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton, Badge } from '@/components/ui/Feedback';

export function Cards() {
  const { unlock } = useAuth();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealedCvv, setRevealedCvv] = useState<{ id: string, value: string } | null>(null);
  const cvvTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(hasSessionKey());
  const [masterPassword, setMasterPassword] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showCvvInForm, setShowCvvInForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    nickname: '', bank: '', cardholder_name: '', card_number: '', expiry_date: '', card_type: 'debit', notes: '', cvv: '', removeCvv: false,
  });

  // Cleanup CVV on unmount
  useEffect(() => {
    return () => {
      if (cvvTimeoutRef.current) clearTimeout(cvvTimeoutRef.current);
      setRevealedCvv(null);
    };
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('cards').select('*').is('deleted_at', null).order('updated_at', { ascending: false });
    setCards(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (vaultUnlocked) load(); }, [vaultUnlocked]);

  const [unlockError, setUnlockError] = useState('');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    
    // Verify password if cards exist
    const { data } = await supabase.from('cards').select('number_encrypted').is('deleted_at', null).limit(1);
    if (data && data.length > 0) {
      try {
        const { setSessionKey, clearSessionKey } = await import('@/lib/crypto');
        setSessionKey(masterPassword);
        await decryptWithSession(data[0].number_encrypted as string);
      } catch (err) {
        setUnlockError('Incorrect master password. Please try again.');
        const { clearSessionKey } = await import('@/lib/crypto');
        clearSessionKey();
        return;
      }
    }

    unlock(masterPassword);
    setVaultUnlocked(true);
    setMasterPassword('');
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ nickname: '', bank: '', cardholder_name: '', card_number: '', expiry_date: '', card_type: 'debit', notes: '', cvv: '', removeCvv: false });
    setShowCvvInForm(false);
    setShowModal(true);
  };

  const handleScanClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text;
      
      // Parse PAN (Luhn validated)
      let pan = '';
      let rawPanToken = '';
      const panRegex = /(?:\d[ -]*?){13,19}/g;
      const matches = text.match(panRegex) || [];
      for (const match of matches) {
        const clean = match.replace(/\D/g, '');
        if (clean.length >= 13 && clean.length <= 19) {
          // Luhn check
          let s = 0;
          let doubleDigit = false;
          for (let i = clean.length - 1; i >= 0; i--) {
            let digit = parseInt(clean.charAt(i));
            if (doubleDigit) {
              digit *= 2;
              if (digit > 9) digit -= 9;
            }
            s += digit;
            doubleDigit = !doubleDigit;
          }
          if (s % 10 === 0) {
            pan = clean;
            rawPanToken = match;
            break;
          }
        }
      }

      // Expiry Date (MM/YY)
      const expiryRegex = /(0[1-9]|1[0-2])[\/\-]([2-9]\d)/;
      const expiryMatch = text.match(expiryRegex);
      let expiry = expiryMatch ? `${expiryMatch[1]}/${expiryMatch[2]}` : '';

      // CVV heuristics
      let cvv = '';
      const cvvRegex = /\b\d{3,4}\b/g;
      const cvvMatches = text.match(cvvRegex) || [];
      let highConfidenceCvv = '';
      let candidateCvv = '';
      
      for (const c of cvvMatches) {
        if (pan && pan.endsWith(c)) continue; // Must not be PAN last 3 or 4 digits
        if (c.match(/^(0[1-9]|1[0-2])[0-9]{2}$/)) continue; // Looks like MMYY date
        
        // Context hint (if it's near CVV, CVC, CID text)
        const contextRegex = new RegExp(`(?:cvv|cvc|cid|security code)[\\s\\S]{0,20}?${c}`, 'is');
        if (contextRegex.test(text)) {
          highConfidenceCvv = c;
          break; 
        } else if (!candidateCvv) {
           candidateCvv = c;
        }
      }
      
      // Strict fallback: only use candidate if there are very few numbers on the card (e.g. back of card scan)
      if (highConfidenceCvv) {
        cvv = highConfidenceCvv;
      } else if (candidateCvv && cvvMatches.length <= 3 && !pan) {
        // If we didn't see a PAN, and there are very few numbers, it's likely the back of the card.
        cvv = candidateCvv;
      } else {
        cvv = ''; // Low confidence, leave blank
      }

      let bank = '';
      let type = 'debit';
      let network = '';
      let foundTypeConfidently = false;

      if (/credit/i.test(text)) { type = 'credit'; foundTypeConfidently = true; }
      else if (/debit/i.test(text)) { type = 'debit'; foundTypeConfidently = true; }
      
      if (/visa/i.test(text)) network = 'Visa';
      if (/mastercard/i.test(text)) network = 'Mastercard';
      if (/amex|american express/i.test(text)) network = 'Amex';

      // Fallback BIN Lookup (Only send first 8 digits)
      if (pan && pan.length >= 8) {
        try {
          const bin = pan.substring(0, 8);
          if (!bank || !network || !foundTypeConfidently) {
            const res = await fetch(`https://data.handyapi.com/bin/${bin}`);
            if (res.ok) {
              const binData = await res.json();
              if (binData.Status === 'SUCCESS') {
                if (!bank && binData.Issuer) bank = binData.Issuer;
                if (!network && binData.Scheme) network = binData.Scheme;
                if (!foundTypeConfidently && binData.Type) type = binData.Type.toLowerCase() === 'credit' ? 'credit' : 'debit';
              }
            }
          }
        } catch (err) {
           console.error("BIN lookup failed, proceeding with local OCR data", err);
        }
      }
      
      setEditing(null);
      setForm({
        nickname: bank ? `${bank} ${network || 'Card'}`.trim() : (network || 'Card'),
        bank: bank,
        cardholder_name: '', // High risk of false positive from raw text
        card_number: pan ? formatCardInput(pan) : '',
        expiry_date: expiry,
        card_type: type,
        notes: 'Scanned via local OCR. Please review fields for accuracy.',
        cvv: cvv,
        removeCvv: false
      });
      setShowCvvInForm(false);
      setShowModal(true);

    } catch (err) {
      console.error(err);
      alert('Error scanning card. Please enter manually.');
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      nickname: c.nickname as string ?? '', bank: c.bank as string ?? '', cardholder_name: c.cardholder_name as string ?? '',
      card_number: '', expiry_date: c.expiry_date as string ?? '', card_type: c.card_type as string ?? 'debit', notes: c.notes as string ?? '',
      cvv: '', removeCvv: false
    });
    setShowCvvInForm(false);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.nickname.trim()) return;
    const lastFour = form.card_number ? form.card_number.replace(/\s/g, '').slice(-4) : '';
    
    let encryptedCvv: string | null | undefined = undefined;
    if (form.removeCvv) {
      encryptedCvv = null;
    } else if (form.cvv) {
      encryptedCvv = await encryptWithSession(form.cvv);
    }
    
    if (editing) {
      const updates: any = {
        nickname: form.nickname, bank: form.bank, cardholder_name: form.cardholder_name,
        expiry_date: form.expiry_date, card_type: form.card_type, notes: form.notes,
      };
      if (form.card_number) {
        updates.last_four = lastFour;
        updates.number_encrypted = await encryptWithSession(form.card_number.replace(/\s/g, ''));
      }
      if (encryptedCvv !== undefined) {
        updates.cvv_encrypted = encryptedCvv;
      }
      await supabase.from('cards').update(updates).eq('id', editing.id as string);
    } else {
      const encrypted = form.card_number ? await encryptWithSession(form.card_number.replace(/\s/g, '')) : null;
      await supabase.from('cards').insert({
        nickname: form.nickname, bank: form.bank, cardholder_name: form.cardholder_name,
        last_four: lastFour || null, number_encrypted: encrypted, expiry_date: form.expiry_date,
        card_type: form.card_type, notes: form.notes,
        cvv_encrypted: encryptedCvv !== undefined ? encryptedCvv : null
      });
      await supabase.from('activity_logs').insert({ action: 'Card added', item_type: 'card', details: form.nickname });
    }
    setShowModal(false);
    load();
  };

  const toggleFav = async (c: any) => {
    await supabase.from('cards').update({ favorite: !(c.favorite as boolean) }).eq('id', c.id as string);
    load();
  };

  const remove = async (c: any) => {
    if (!confirm('Delete this card?')) return;
    await supabase.from('cards').update({ deleted_at: new Date().toISOString() }).eq('id', c.id as string);
    load();
  };

  const reveal = async (c: any) => {
    if (revealed[c.id as string]) {
      setRevealed((prev) => { const next = { ...prev }; delete next[c.id as string]; return next; });
      return;
    }
    if (!c.number_encrypted) return;
    try {
      const plain = await decryptWithSession(c.number_encrypted as string);
      setRevealed((prev) => ({ ...prev, [c.id as string]: plain }));
      await supabase.from('activity_logs').insert({ action: 'Card number viewed', item_type: 'card', details: c.nickname as string, sensitive: true });
    } catch { /* decryption failed */ }
  };

  const revealCvv = async (c: any) => {
    if (revealedCvv?.id === c.id) {
      setRevealedCvv(null);
      if (cvvTimeoutRef.current) clearTimeout(cvvTimeoutRef.current);
      return;
    }
    if (!c.cvv_encrypted) return;
    try {
      const plain = await decryptWithSession(c.cvv_encrypted as string);
      setRevealedCvv({ id: c.id, value: plain });
      await supabase.from('activity_logs').insert({ action: 'Card CVV viewed', item_type: 'card', details: c.nickname as string, sensitive: true });
      
      if (cvvTimeoutRef.current) clearTimeout(cvvTimeoutRef.current);
      cvvTimeoutRef.current = setTimeout(() => setRevealedCvv(null), 10000);
    } catch { /* decryption failed */ }
  };

  const copyNumber = async (c: any) => {
    const value = revealed[c.id as string];
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedId(c.id as string);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCardInput = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 19);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  if (!vaultUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-sky-50 dark:bg-sky-950/50 text-sky-600">
          <Lock className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 mb-1">Sensitive Area</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-8 text-center max-w-xs">
          Card details are encrypted. Enter your master password to access this section.
        </p>
        <form onSubmit={handleUnlock} className="w-full max-w-sm space-y-4">
          <Input type="password" placeholder="Master password" value={masterPassword} onChange={(e) => { setMasterPassword(e.target.value); setUnlockError(''); }} required icon={<Lock className="h-5 w-5" />} />
          {unlockError && <p className="text-sm text-red-500 text-center">{unlockError}</p>}
          <Button type="submit" className="w-full"><Unlock className="h-4 w-4" /> Unlock Wallet</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Cards</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{cards.length} cards, encrypted</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            className="hidden" 
          />
          <Button size="sm" variant="outline" onClick={handleScanClick} disabled={isScanning}>
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Camera className="h-4 w-4 mr-1" />} 
            Scan Card
          </Button>
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Enter Manually</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-9 w-9" />}
          title="No cards yet"
          description="Securely store your debit and credit cards. Card numbers are encrypted with AES-256."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Card</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((c) => {
            const isRevealed = !!revealed[c.id as string];
            const lastFour = (c.last_four as string) ?? '';
            return (
              <div key={c.id as string} className="p-5 rounded-2xl bg-gradient-to-br from-ink-800 to-ink-900 dark:from-ink-800 dark:to-ink-950 text-white shadow-lg">
                <div className="flex items-start justify-between mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <CreditCard className="h-5 w-5" />
                  </span>
                  <button onClick={() => toggleFav(c)} className={cn('p-1.5 rounded-lg hover:bg-white/10 transition', c.favorite ? 'text-amber-400' : 'text-white/50')}>
                    <Star className={cn('h-4 w-4', c.favorite && 'fill-current')} />
                  </button>
                </div>
                <div className="font-mono text-lg tracking-wider mb-3">
                  {isRevealed && c.number_encrypted
                    ? revealed[c.id as string].replace(/(.{4})/g, '$1 ').trim()
                    : maskCardNumber(lastFour)}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    {c.cardholder_name && <div className="text-sm font-medium">{c.cardholder_name as string}</div>}
                    {c.bank && <div className="text-xs text-white/60">{c.bank as string}</div>}
                  </div>
                  <div className="text-right">
                    {c.expiry_date && <div className="text-xs text-white/60">{c.expiry_date as string}</div>}
                    <Badge color="gray" className="bg-white/10 text-white/80 mt-1 capitalize">{c.card_type as string}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
                  {c.number_encrypted && (
                    <>
                      <button onClick={() => reveal(c)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition" title="Reveal Card Number">
                        {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button onClick={() => copyNumber(c)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition" title="Copy Card Number">
                        {copiedId === c.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </>
                  )}
                  {c.cvv_encrypted && (
                    <div className="flex items-center ml-2 border-l border-white/10 pl-2 gap-2">
                      <span className="text-xs text-white/60 font-medium">CVV</span>
                      <button onClick={() => revealCvv(c)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 transition text-white/90">
                        {revealedCvv?.id === c.id ? (
                          <span className="font-mono tracking-widest">{revealedCvv.value}</span>
                        ) : (
                          <span className="font-mono tracking-widest">•••</span>
                        )}
                      </button>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition">
                      <CreditCard className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(c)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-400 transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Card' : 'Add Card'} size="md">
        <div className="space-y-4">
          <Input label="Nickname" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="e.g. Main Debit, Travel Card" />
          <Input label="Bank" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="e.g. Chase, HSBC" />
          <Input label="Cardholder Name" value={form.cardholder_name} onChange={(e) => setForm({ ...form, cardholder_name: e.target.value })} />
          <Input label="Card Number" value={form.card_number} onChange={(e) => setForm({ ...form, card_number: formatCardInput(e.target.value) })} placeholder={editing ? '•••• ' + (editing.last_four || '••••') : '0000 0000 0000 0000'} inputMode="numeric" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Expiry Date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} placeholder="MM/YY" />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">CVV</label>
              <div className="relative">
                <input 
                  type={showCvvInForm ? "text" : "password"} 
                  maxLength={4} 
                  inputMode="numeric"
                  className="input-field pr-10 font-mono" 
                  value={form.cvv} 
                  onChange={(e) => setForm({ ...form, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })} 
                  placeholder={editing ? (editing.cvv_encrypted ? "••• (Saved)" : "•••") : "•••"} 
                  disabled={form.removeCvv}
                />
                <button type="button" onClick={() => setShowCvvInForm(!showCvvInForm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 transition">
                  {showCvvInForm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          
          {editing && editing.cvv_encrypted && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/50">
              <input 
                type="checkbox" 
                id="remove-cvv" 
                checked={form.removeCvv} 
                onChange={(e) => setForm({ ...form, removeCvv: e.target.checked, cvv: e.target.checked ? '' : form.cvv })} 
                className="rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="remove-cvv" className="text-sm font-medium text-red-800 dark:text-red-400 cursor-pointer">
                Remove stored CVV
              </label>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">Card Type</label>
            <select className="input-field" value={form.card_type} onChange={(e) => setForm({ ...form, card_type: e.target.value })}>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
              <option value="atm">ATM</option>
            </select>
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          <p className="text-xs text-ink-400">Card numbers and CVV are encrypted with AES-256-GCM before storage.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save}>{editing ? 'Save' : 'Add Card'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
