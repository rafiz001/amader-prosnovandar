import { useState } from 'react';
import { bnNum } from '../../lib/utils.js';
import { QuestionFilterPanel } from '../questions/QuestionFilterPanel.jsx';
import { QuestionPicker } from '../questions/QuestionPicker.jsx';
import { Button, Modal } from '../ui/index.js';

const EMPTY_FILTERS = {
  q: '',
  kind: '',
  difficulty: '',
  lang: '',
  chapter_id: '',
  type_id: '',
};

export function AddQuestionsModal({ subjectId, lockedIds, onClose, onAdd }) {
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState({ limit: 20, offset: 0 });

  const toggle = (question) =>
    setSelected((list) =>
      list.some((item) => item.id === question.id)
        ? list.filter((item) => item.id !== question.id)
        : [...list, question]
    );

  const selectAll = (items) =>
    setSelected((list) => {
      const byId = new Map(list.map((question) => [question.id, question]));
      items.forEach((question) => {
        if (!lockedIds.has(question.id)) byId.set(question.id, question);
      });
      return [...byId.values()];
    });

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage((current) => ({ ...current, offset: 0 }));
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage((current) => ({ ...current, offset: 0 }));
  };

  const add = () => {
    const fresh = selected.filter((question) => !lockedIds.has(question.id));
    onAdd(fresh);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="প্রশ্ন যোগ করুন"
      description="আগে থেকে যোগ করা প্রশ্নগুলো নিষ্ক্রিয় দেখানো হয়েছে"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button icon="plus" onClick={add} disabled={selected.length === 0}>
            {bnNum(selected.length)}টি প্রশ্ন যোগ করুন
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <QuestionPicker
            subjectId={subjectId}
            selected={selected}
            onToggle={toggle}
            onClear={() => setSelected([])}
            onSelectAll={selectAll}
            filters={filters}
            page={page}
            onPageChange={setPage}
            lockedIds={lockedIds}
          />
        </div>
        <aside className="self-start">
          <QuestionFilterPanel
            subjectId={subjectId}
            filters={filters}
            onChange={updateFilter}
            onReset={resetFilters}
          />
        </aside>
      </div>
    </Modal>
  );
}
