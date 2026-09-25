'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { hrApi, type Employee, type EmploymentStatus } from '../../lib/hr-api';
import { ApiError } from '../../lib/api';
import { NumericInput, PhoneInput, toNumber } from '../ui/inputs';
import { toast } from '../ui/Toast';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

export function EmployeeFormDrawer({
  open,
  onClose,
  onSaved,
  employee,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employee: Employee | null;
}) {
  const isEdit = !!employee;
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentStartDate, setEmploymentStartDate] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>('ACTIVE');
  const [baseSalary, setBaseSalary] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(employee?.displayName ?? '');
    setPhone(employee?.phone ?? '');
    setJobTitle(employee?.jobTitle ?? '');
    setDepartment(employee?.department ?? '');
    setEmploymentStartDate(employee?.employmentStartDate ? employee.employmentStartDate.slice(0, 10) : '');
    setEmploymentStatus(employee?.employmentStatus ?? 'ACTIVE');
    setBaseSalary(employee?.baseSalary != null ? String(employee.baseSalary) : '');
    setEmergencyContactName(employee?.emergencyContactName ?? '');
    setEmergencyContactPhone(employee?.emergencyContactPhone ?? '');
    setNotes(employee?.notes ?? '');
    setError(null);
  }, [open, employee]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        displayName,
        phone: phone || undefined,
        jobTitle: jobTitle || undefined,
        department: department || undefined,
        employmentStartDate: employmentStartDate || undefined,
        employmentStatus,
        baseSalary: toNumber(baseSalary) ?? undefined,
        emergencyContactName: emergencyContactName || undefined,
        emergencyContactPhone: emergencyContactPhone || undefined,
        notes: notes || undefined,
      };
      if (isEdit && employee) await hrApi.update(employee.id, payload);
      else await hrApi.create(payload);
      toast.success('Employee saved');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save employee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      guardUnsaved
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit employee' : 'Add employee'}
      footer={
        <div className="flex items-center gap-3">
          <button type="submit" form="employee-form" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add employee'}
          </button>
          {error && (
            <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="employeeformdrawer-full-name" className={labelClass} style={labelStyle}>
            Full name
          </label>
          <input id="employeeformdrawer-full-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="employeeformdrawer-job-title" className={labelClass} style={labelStyle}>
              Job title
            </label>
            <input id="employeeformdrawer-job-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="employeeformdrawer-department" className={labelClass} style={labelStyle}>
              Department
            </label>
            <input id="employeeformdrawer-department" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="employeeformdrawer-phone" className={labelClass} style={labelStyle}>
              Phone
            </label>
            <PhoneInput id="employeeformdrawer-phone" value={phone} onChange={setPhone} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="employeeformdrawer-start-date" className={labelClass} style={labelStyle}>
              Start date
            </label>
            <input id="employeeformdrawer-start-date" type="date" value={employmentStartDate} onChange={(e) => setEmploymentStartDate(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="employeeformdrawer-base-salary-ksh-month" className={labelClass} style={labelStyle}>
              Base salary (KSh/month)
            </label>
            <NumericInput id="employeeformdrawer-base-salary-ksh-month" value={baseSalary} onChange={setBaseSalary} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="employeeformdrawer-status" className={labelClass} style={labelStyle}>
              Status
            </label>
            <select id="employeeformdrawer-status" value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value as EmploymentStatus)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle}>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="employeeformdrawer-emergency-contact" className={labelClass} style={labelStyle}>
              Emergency contact
            </label>
            <input id="employeeformdrawer-emergency-contact" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="employeeformdrawer-emergency-phone" className={labelClass} style={labelStyle}>
              Emergency phone
            </label>
            <PhoneInput id="employeeformdrawer-emergency-phone" value={emergencyContactPhone} onChange={setEmergencyContactPhone} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>
        <div>
          <label htmlFor="employeeformdrawer-notes" className={labelClass} style={labelStyle}>
            Notes
          </label>
          <textarea id="employeeformdrawer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
      </form>
    </Drawer>
  );
}