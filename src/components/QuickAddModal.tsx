import { Upload, Award, Briefcase, KeyRound, CreditCard, StickyNote, FileText, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
}

const actions = [
  { label: 'Upload Document', icon: <Upload className="h-5 w-5" />, path: '/documents', color: 'text-brand-600' },
  { label: 'Add Certificate', icon: <Award className="h-5 w-5" />, path: '/certificates', color: 'text-amber-600' },
  { label: 'Add Project', icon: <Briefcase className="h-5 w-5" />, path: '/projects', color: 'text-emerald-600' },
  { label: 'Add Resume', icon: <FileText className="h-5 w-5" />, path: '/resumes', color: 'text-violet-600' },
  { label: 'Add Password', icon: <KeyRound className="h-5 w-5" />, path: '/passwords', color: 'text-red-600' },
  { label: 'Add Card', icon: <CreditCard className="h-5 w-5" />, path: '/cards', color: 'text-sky-600' },
  { label: 'Add Secure Note', icon: <StickyNote className="h-5 w-5" />, path: '/notes', color: 'text-orange-600' },
  { label: 'Add Profile Link', icon: <Link2 className="h-5 w-5" />, path: '/profile', color: 'text-purple-600' },
];

export function QuickAddModal({ open, onClose, onUpload }: QuickAddModalProps) {
  const navigate = useNavigate();

  const handleAction = (action: (typeof actions)[number]) => {
    if (action.label === 'Upload Document') {
      onUpload();
    } else {
      navigate(action.path);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick Add" size="md">
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleAction(action)}
            className="flex flex-col items-start gap-3 p-4 rounded-2xl border border-ink-200 dark:border-ink-800 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/50 dark:hover:bg-brand-950/30 transition text-left"
          >
            <span className={action.color}>{action.icon}</span>
            <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{action.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
