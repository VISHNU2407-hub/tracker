import React from 'react';
import type { AppDataApi } from '../../hooks/useAppData';
import { Modal } from '../ui/Modal';
import { DayTasks } from '../dashboard/DayTasks';
import { ProgressRing } from '../ui/ProgressRing';
import { dayNumber, formatLong, todayISO } from '../../services/date';
import { evaluateDay } from '../../services/analytics';
import { trackScope } from '../../hooks/useArc';

interface DayDetailProps {
  date: string;
  api: AppDataApi;
  onClose: () => void;
  onOpenReflection?: () => void;
}

/** Detail modal for a specific day (spec §3 Calendar: "Click a day for details"). */
export function DayDetail({ date, api, onClose }: DayDetailProps) {
  const { data } = api;
  const arc = data.arc!;
  const { habits: scopedHabits, rules: scopedRules } = trackScope(data);
  const today = todayISO();
  const ev = arc ? evaluateDay(arc, scopedHabits, scopedRules, data.dailyRecords, date, todayISO()) : null;
  const rec = data.dailyRecords[date];

  const dn = dayNumber(date, arc.startDate, arc.durationDays);
  const isFuture = date > today;
  const dayNum = Math.max(1, Math.min(dn, arc.durationDays));

  return (
    <Modal
      title={`Day ${dayNum} · ${formatLong(date)}`}
      onClose={onClose}
      wide
      footer={
        isFuture ? (
          <button type="button" className="btn" onClick={onClose}>Close</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        )
      }
    >
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <ProgressRing pct={ev?.pct ?? null} size={86} stroke={8} label={`Day ${dayNum}`} />
        <div>
          <div style={{ fontWeight: 700 }}>
            {ev?.pct === null
              ? 'Nothing was trackable on this day'
              : ev?.isPerfect
                ? 'Perfect day — everything done & every rule followed'
                : `${ev?.completedCount ?? 0} of ${ev?.eligibleCount ?? 0} done · ${ev?.habitDone ?? 0} habits + ${ev?.ruleFollowed ?? 0} rules`}
          </div>
          <div className="secondary small" style={{ marginTop: 3 }}>
            {isFuture
              ? 'Future day — view only.'
              : date < today
                ? 'Past day — read only. Only today can be updated.'
                : 'Today.'}
          </div>
        </div>
      </div>

      {/* Today: editable. Past days render inside DayTasks as read-only history. */}
      {!isFuture && (
        <DayTasks
          arc={arc}
          habits={scopedHabits}
          rules={scopedRules}
          records={data.dailyRecords}
          date={date}
          now={today}
          onToggle={api.toggleHabit}
          onSetValue={api.setHabitValue}
          onRuleStatus={api.setRuleStatus}
          compact
        />
      )}

      {isFuture && (
        <div className="empty-state">
          <div className="big">Upcoming day</div>
          <p>Completion unlocks when this day arrives.</p>
        </div>
      )}

      {rec?.note && (
        <div className="refl-card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 6 }}>Daily note</div>
          <p className="secondary" style={{ whiteSpace: 'pre-wrap' }}>{rec.note}</p>
        </div>
      )}
    </Modal>
  );
}
