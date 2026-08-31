import { useEffect, useState } from 'react';
import {
  User, Plus, Trash2, Link2, Github, Linkedin, Globe, Instagram,
  Twitter, Youtube, ExternalLink, Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';

const platformIcons: Record<string, React.ReactNode> = {
  github: <Github className="h-5 w-5" />,
  linkedin: <Linkedin className="h-5 w-5" />,
  instagram: <Instagram className="h-5 w-5" />,
  twitter: <Twitter className="h-5 w-5" />,
  youtube: <Youtube className="h-5 w-5" />,
  website: <Globe className="h-5 w-5" />,
  portfolio: <Link2 className="h-5 w-5" />,
  other: <Link2 className="h-5 w-5" />,
};

export function Profile() {
  const { profile, refreshProfile, user } = useAuth();
  const [socials, setSocials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [editingSocial, setEditingSocial] = useState<any | null>(null);
  const [profileForm, setProfileForm] = useState({
    full_name: '', professional_title: '', bio: '', email: '', phone: '', location: '', website: '', portfolio: '',
  });
  const [socialForm, setSocialForm] = useState({ platform: '', username: '', url: '', description: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('social_profiles').select('*').order('created_at', { ascending: false });
    setSocials(data ?? []);
    if (profile) {
      setProfileForm({
        full_name: profile.full_name ?? '', professional_title: profile.professional_title ?? '',
        bio: profile.bio ?? '', email: profile.email ?? '', phone: profile.phone ?? '',
        location: profile.location ?? '', website: profile.website ?? '', portfolio: profile.portfolio ?? '',
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const saveProfile = async () => {
    setSavingProfile(true);
    if (profile) {
      await supabase.from('profiles').update(profileForm).eq('id', profile.id);
    } else if (user) {
      await supabase.from('profiles').insert({ ...profileForm, user_id: user.id });
    }
    await refreshProfile();
    setSavingProfile(false);
  };

  const openAddSocial = () => {
    setEditingSocial(null);
    setSocialForm({ platform: '', username: '', url: '', description: '' });
    setShowSocialModal(true);
  };

  const openEditSocial = (s: any) => {
    setEditingSocial(s);
    setSocialForm({ platform: s.platform as string ?? '', username: s.username as string ?? '', url: s.url as string ?? '', description: s.description as string ?? '' });
    setShowSocialModal(true);
  };

  const saveSocial = async () => {
    if (!socialForm.platform.trim()) return;
    if (editingSocial) {
      await supabase.from('social_profiles').update(socialForm).eq('id', editingSocial.id as string);
    } else {
      await supabase.from('social_profiles').insert(socialForm);
    }
    setShowSocialModal(false);
    load();
  };

  const removeSocial = async (s: any) => {
    if (!confirm('Delete this profile link?')) return;
    await supabase.from('social_profiles').delete().eq('id', s.id as string);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Profile</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">Your private professional identity hub</p>
      </div>

      {/* Profile card */}
      {loading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="card p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600 text-white text-2xl font-bold shrink-0">
              {(profileForm.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">{profileForm.full_name || 'Your Name'}</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400">{profileForm.professional_title || 'Add your professional title'}</p>
              {profileForm.bio && <p className="text-sm text-ink-600 dark:text-ink-300 mt-2">{profileForm.bio}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Name" value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} />
            <Input label="Professional Title" value={profileForm.professional_title} onChange={(e) => setProfileForm({ ...profileForm, professional_title: e.target.value })} />
            <Input label="Email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
            <Input label="Phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
            <Input label="Location" value={profileForm.location} onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })} />
            <Input label="Website" value={profileForm.website} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })} />
            <Input label="Portfolio" value={profileForm.portfolio} onChange={(e) => setProfileForm({ ...profileForm, portfolio: e.target.value })} />
            <div className="sm:col-span-2">
              <Textarea label="Bio" value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} rows={3} />
            </div>
          </div>
          <Button className="mt-4" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      )}

      {/* Social profiles */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide">Social Profiles</h2>
          <Button size="sm" variant="secondary" onClick={openAddSocial}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {socials.length === 0 ? (
          <div className="card p-8 text-center">
            <Link2 className="h-8 w-8 text-ink-300 mx-auto mb-2" />
            <p className="text-sm text-ink-400">Add your social and professional profile links.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {socials.map((s) => {
              const iconKey = (s.platform as string).toLowerCase();
              return (
                <div key={s.id as string} className="flex items-center gap-3 p-4 rounded-2xl card hover:shadow-md transition">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-500 shrink-0">
                    {platformIcons[iconKey] ?? <Link2 className="h-5 w-5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{s.platform as string}</div>
                    {s.username && <div className="text-xs text-ink-400 truncate">{s.username as string}</div>}
                  </div>
                  {s.url && (
                    <a href={s.url as string} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-brand-600 transition">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button onClick={() => openEditSocial(s)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
                    <User className="h-4 w-4" />
                  </button>
                  <button onClick={() => removeSocial(s)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-ink-400 hover:text-red-500 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showSocialModal} onClose={() => setShowSocialModal(false)} title={editingSocial ? 'Edit Profile Link' : 'Add Profile Link'} size="md">
        <div className="space-y-4">
          <Input label="Platform" value={socialForm.platform} onChange={(e) => setSocialForm({ ...socialForm, platform: e.target.value })} placeholder="e.g. GitHub, LinkedIn, Instagram" />
          <Input label="Username" value={socialForm.username} onChange={(e) => setSocialForm({ ...socialForm, username: e.target.value })} placeholder="@username" />
          <Input label="URL" value={socialForm.url} onChange={(e) => setSocialForm({ ...socialForm, url: e.target.value })} placeholder="https://..." />
          <Textarea label="Description" value={socialForm.description} onChange={(e) => setSocialForm({ ...socialForm, description: e.target.value })} rows={2} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowSocialModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveSocial}>{editingSocial ? 'Save' : 'Add Link'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
