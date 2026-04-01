import { useState, useRef } from 'react';
import { transportService } from '../services/transportService';
import type { Employee, Agent, User } from '../types';
import type { Language } from '../constants/translations';

/** External dependencies that useEmployees needs from App.tsx */
export interface EmployeeContext {
  language: Language;
  agents: Agent[];
  employees: Employee[];
  currentUser?: User | null;
}

export const DEFAULT_EMPLOYEE_FORM = {
  name: '',
  phone: '',
  email: '',
  address: '',
  role: 'STAFF',
  position: '',
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  username: '',
  password: '',
  note: '',
};

/**
 * useEmployees – encapsulates employee CRUD state and handlers.
 * Pattern follows useTrips / useRoutes hooks in this codebase.
 */
export function useEmployees(ctx: EmployeeContext) {
  const { language } = ctx;

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ ...DEFAULT_EMPLOYEE_FORM });
  const [employeeFormError, setEmployeeFormError] = useState('');
  // Conflict detection: tracks the updatedAt of the employee when editing was opened
  const editingEmployeeUpdatedAtRef = useRef<string | null>(null);
  const [employeeConflictWarning, setEmployeeConflictWarning] = useState(false);

  // Keep a stable ref so async handlers always read the latest context values.
  const ctxRef = useRef<EmployeeContext>(ctx);
  ctxRef.current = ctx;

  /** Returns true if the username is already taken by another agent or employee */
  const isUsernameTaken = (
    username: string,
    excludeAgentId?: string,
    excludeEmployeeId?: string,
  ): boolean => {
    const { agents: ctxAgents, employees: ctxEmployees } = ctxRef.current;
    const normalized = username.trim().toLowerCase();
    const takenByAgent = ctxAgents.some(
      a =>
        a.username &&
        String(a.username).trim().toLowerCase() === normalized &&
        (!excludeAgentId || a.id !== excludeAgentId),
    );
    const takenByEmployee = ctxEmployees.some(
      emp =>
        emp.username &&
        String(emp.username).trim().toLowerCase() === normalized &&
        (!excludeEmployeeId || emp.id !== excludeEmployeeId),
    );
    return takenByAgent || takenByEmployee;
  };

  const handleSaveEmployee = async (forceOverwrite = false) => {
    try {
      if (employeeForm.username && employeeForm.username.trim()) {
        if (isUsernameTaken(employeeForm.username, undefined, editingEmployee?.id)) {
          setEmployeeFormError(
            language === 'vi'
              ? 'Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác.'
              : 'This username already exists, please choose another.',
          );
          return;
        }
      }
      setEmployeeFormError('');
      // Conflict detection: compare updatedAt snapshots for existing employees
      if (editingEmployee && !forceOverwrite && editingEmployeeUpdatedAtRef.current !== null) {
        const liveEmployee = ctxRef.current.employees.find(e => e.id === editingEmployee.id);
        const liveUpdatedAt = liveEmployee?.updatedAt ?? null;
        if (liveUpdatedAt && liveUpdatedAt !== editingEmployeeUpdatedAtRef.current) {
          setEmployeeConflictWarning(true);
          return;
        }
      }
      setEmployeeConflictWarning(false);
      if (editingEmployee) {
        await transportService.updateEmployee(editingEmployee.id, employeeForm);
        const actor = ctxRef.current.currentUser;
        if (actor) {
          await transportService.logAudit({
            actorId: actor.id, actorName: actor.name, actorRole: actor.role,
            action: 'EDIT_EMPLOYEE', targetType: 'employee',
            targetId: editingEmployee.id, targetLabel: employeeForm.name || editingEmployee.id,
            detail: `Cập nhật nhân viên: ${employeeForm.name}`,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        await transportService.addEmployee(employeeForm);
        const actor = ctxRef.current.currentUser;
        if (actor) {
          await transportService.logAudit({
            actorId: actor.id, actorName: actor.name, actorRole: actor.role,
            action: 'ADD_EMPLOYEE', targetType: 'employee',
            targetLabel: employeeForm.name,
            detail: `Thêm nhân viên mới: ${employeeForm.name}`,
            createdAt: new Date().toISOString(),
          });
        }
      }
      setShowAddEmployee(false);
      setEditingEmployee(null);
      setEmployeeForm({ ...DEFAULT_EMPLOYEE_FORM });
    } catch (err) {
      console.error('Failed to save employee:', err);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    const msg =
      language === 'vi'
        ? 'Bạn có chắc muốn xóa nhân viên này?'
        : 'Delete this employee?';
    if (!window.confirm(msg)) return;
    try {
      await transportService.deleteEmployee(employeeId);
      const actor = ctxRef.current.currentUser;
      const deletedEmployee = ctxRef.current.employees.find(e => e.id === employeeId);
      if (actor) {
        await transportService.logAudit({
          actorId: actor.id, actorName: actor.name, actorRole: actor.role,
          action: 'DELETE_EMPLOYEE', targetType: 'employee',
          targetId: employeeId, targetLabel: deletedEmployee?.name || employeeId,
          detail: `Xóa nhân viên: ${deletedEmployee?.name || employeeId}`,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Failed to delete employee:', err);
    }
  };

  const handleStartEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeConflictWarning(false);
    editingEmployeeUpdatedAtRef.current = employee.updatedAt ?? null;
    setEmployeeForm({
      name: String(employee.name ?? ''),
      phone: String(employee.phone ?? ''),
      email: String(employee.email ?? ''),
      address: String(employee.address ?? ''),
      role: employee.role,
      position: String(employee.position ?? ''),
      status: employee.status,
      username: String(employee.username ?? ''),
      password: String(employee.password ?? ''),
      note: String(employee.note ?? ''),
    });
    setEmployeeFormError('');
    setShowAddEmployee(true);
  };

  return {
    showAddEmployee,
    setShowAddEmployee,
    editingEmployee,
    setEditingEmployee,
    employeeForm,
    setEmployeeForm,
    employeeFormError,
    setEmployeeFormError,
    employeeConflictWarning,
    setEmployeeConflictWarning,
    handleSaveEmployee,
    handleForceSaveEmployee: () => handleSaveEmployee(true),
    handleDeleteEmployee,
    handleStartEditEmployee,
  };
}
