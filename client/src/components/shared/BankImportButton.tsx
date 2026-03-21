import { useState } from 'react';
import { Upload } from 'lucide-react';
import Modal from './Modal';
import UploadZone from '../bank/UploadZone';

export default function BankImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <Upload size={16} />
        ייבוא מהבנק ↑
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="ייבוא מהבנק">
        <UploadZone />
      </Modal>
    </>
  );
}
