import { useState } from 'react';
import { transportService } from '../services/transportService';
import type { Employee, Agent } from '../types';
import type { Language } from '../constants/translations';

export interface EmployeeContext {
  language: Language;
  agents: Agent[];
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
  const { language, agents } = ctx;

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ ...DEFAULT_EMPLOYEE_FORM });
  const [employeeFormError, setEmployeeFormError] = useState('');

  /** Returns true if the username is already taken by another agent or employee */
  const isUsernameTaken = (
    username: string,
    employees: Employee[],
    excludeAgentId?: string,
    excludeEmployeeId?: string,
  ): boolean => {
    const normalized = username.trim().toLowerCase();
    const takenByAgent = agents.some(
      a =>
        a.username &&
        String(a.username).trim().toLowerCase() === normalized &&
        (!excludeAgentId || a.id !== excludeAgentId),
    );
    const takenByEmployee = employees.some(
      emp =>
        emp.username &&
        String(emp.username).trim().toLowerCase() === normalized &&
        (!excludeEmployeeId || emp.id !== excludeEmployeeId),
    );
    return takenByAgent || takenByEmployee;
  };

  const handleSaveEmployee = async (employees: Employee[]) => {
    try {
      if (employeeForm.username && employeeForm.username.trim()) {
        if (isUsernameTaken(employeeForm.username, employees, undefined, editingEmployee?.id)) {
          setEmployeeFormError(
            language === 'vi'
              ? 'Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác.'
              : 'This username already exists, please choose another.',
          );
          return;
        }
      }
      setEmployeeFormError('');
      if (editingEmployee) {
        await transportService.updateEmployee(editingEmployee.id, employeeForm);
      } else {
        await transportService.addEmployee(employeeForm);
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
    } catch (err) {
      console.error('Failed to delete employee:', err);
    }
  };

  const handleStartEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
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
    handleSaveEmployee,
    handleDeleteEmployee,
    handleStartEditEmployee,
  };
}
