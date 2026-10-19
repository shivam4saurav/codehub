import { useState } from 'react';

import { useToast } from '../../context/ToastContext.jsx';
import Button from '../ui/Button.jsx';
import { Textarea } from '../ui/Input.jsx';
import Modal from '../ui/Modal.jsx';

/**
 * The editable body lives in its own component and is mounted with a `key` tied
 * to the problem. Remounting is React's own answer to "reset state when the
 * input changes", and it keeps the initial value in a useState initialiser
 * instead of a syncing effect.
 */
const NoteForm = ({ problem, onSave, onClose }) => {
  const [note, setNote] = useState(problem?.bookmark?.note ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(problem.id, note);
      toast.success('Note saved', problem.name);
      onClose();
    } catch (error) {
      toast.error('Could not save note', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Textarea
        label="Your note"
        rows={6}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={4000}
        placeholder="Approach, edge cases, why it failed the first time…"
        hint={`${note.length}/4000`}
      />

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={isSaving}>
          Save note
        </Button>
      </div>
    </>
  );
};

/** Personal note on a problem. Saving also bookmarks it, so notes never orphan. */
export const NoteDialog = ({ problem, open, onOpenChange, onSave }) => (
  <Modal
    open={open}
    onOpenChange={onOpenChange}
    title={problem ? `Note on ${problem.name}` : 'Note'}
    description="Only you can see this. Saving a note also bookmarks the problem."
  >
    {problem ? (
      <NoteForm
        key={problem.id}
        problem={problem}
        onSave={onSave}
        onClose={() => onOpenChange(false)}
      />
    ) : null}
  </Modal>
);

export default NoteDialog;
