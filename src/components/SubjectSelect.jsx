import React from 'react';
import { setActiveSubject } from '../lib/store.js';
import { SUBJECT_CATALOG, STAGES } from '../data/subjects.js';

export default function SubjectSelect({ value, tone = 'dark', compact = false }) {
  return (
    <select
      className={`subject-select ${tone} ${compact ? 'compact' : ''}`}
      value={value}
      onChange={(e) => setActiveSubject(e.target.value)}
      aria-label="选择学科"
    >
      {Object.values(STAGES).map((stage) => (
        <optgroup key={stage.key} label={stage.label}>
          {SUBJECT_CATALOG.filter((s) => s.stage === stage.key).map((s) => (
            <option key={s.key} value={s.key}>
              {stage.label}{s.name}{s.ready ? '' : ' · 待接入'}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
