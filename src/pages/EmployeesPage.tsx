import React from 'react';
import { Users, Truck, Search, Filter, X, Edit3, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language } from '../constants/translations';
import { Employee } from '../types';

type EmployeeForm = {
  name: string; phone: string; email: string; address: string;
  role: string; position: string; status: 'ACTIVE' | 'INACTIVE';
  username: string; password: string; note: string;
};

interface EmployeesPageProps {
  employees: Employee[];
  employeeSearch: string;
  employeeRoleFilter: string;
  showEmployeeFilters: boolean;
  showAddEmployee: boolean;
  editingEmployee: Employee | null;
  employeeForm: EmployeeForm;
  employeeFormError: string;
  language: Language;
  permissions: Record<string, Record<string, boolean>> | null;
  handleSaveEmployee: () => void;
  handleDeleteEmployee: (id: string) => void;
  handleStartEditEmployee: (emp: Employee) => void;
  setShowAddEmployee: (v: boolean) => void;
  setEditingEmployee: (v: Employee | null) => void;
  setEmployeeForm: React.Dispatch<React.SetStateAction<EmployeeForm>>;
  setEmployeeFormError: (v: string) => void;
  setEmployeeSearch: (v: string) => void;
  setEmployeeRoleFilter: (v: string) => void;
  setShowEmployeeFilters: React.Dispatch<React.SetStateAction<boolean>>;
}

export function EmployeesPage({
  employees,
  employeeSearch,
  employeeRoleFilter,
  showEmployeeFilters,
  showAddEmployee,
  editingEmployee,
  employeeForm,
  employeeFormError,
  language,
  permissions,
  handleSaveEmployee,
  handleDeleteEmployee,
  handleStartEditEmployee,
  setShowAddEmployee,
  setEditingEmployee,
  setEmployeeForm,
  setEmployeeFormError,
  setEmployeeSearch,
  setEmployeeRoleFilter,
  setShowEmployeeFilters,
}: EmployeesPageProps) {
  const t = TRANSLATIONS[language];

  const filteredEmployees = employees.filter(emp => {
    const q = employeeSearch.toLowerCase();
    const matchSearch = !q ||
      String(emp.name ?? '').toLowerCase().includes(q) ||
      String(emp.phone ?? '').toLowerCase().includes(q) ||
      String(emp.email ?? '').toLowerCase().includes(q) ||
      String(emp.username ?? '').toLowerCase().includes(q);
    const matchRole = employeeRoleFilter === 'ALL' || emp.role === employeeRoleFilter;
    return matchSearch && matchRole;
  });

  const EMPLOYEE_ROLE_LABELS: Record<string, string> = {
    SUPERVISOR: language === 'vi' ? 'Quản lý' : 'Supervisor',
    STAFF: t.role_staff || 'Nhân viên',
    DRIVER: t.role_driver || 'Tài xế',
    ACCOUNTANT: t.role_accountant || 'Kế toán',
    OTHER: t.role_other || 'Khác',
    AGENT: language === 'vi' ? 'Đại lý' : 'Agent',
  };
  const EMPLOYEE_ROLE_COLORS: Record<string, string> = {
    SUPERVISOR: 'bg-indigo-50 text-indigo-600',
    STAFF: 'bg-blue-50 text-blue-600',
    DRIVER: 'bg-green-50 text-green-600',
    ACCOUNTANT: 'bg-purple-50 text-purple-600',
    OTHER: 'bg-gray-100 text-gray-500',
    AGENT: 'bg-orange-50 text-orange-600',
  };

  // Derive available permission groups from the permissions config (exclude MANAGER, CUSTOMER and GUEST)
  const availableRoles = permissions
    ? Object.keys(permissions).filter(r => r !== 'MANAGER' && r !== 'CUSTOMER' && r !== 'GUEST')
    : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t.employee_management || 'Quản lý Nhân viên'}</h2>
          <p className="text-sm text-gray-500">{t.employee_desc || 'Quản lý nhân viên, tài xế và tài khoản đăng nhập'}</p>
        </div>
        <button onClick={() => { setShowAddEmployee(true); setEditingEmployee(null); setEmployeeForm({ name: '', phone: '', email: '', address: '', role: availableRoles[0] || 'STAFF', position: '', status: 'ACTIVE', username: '', password: '', note: '' }); setEmployeeFormError(''); }} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_employee || 'Thêm nhân viên'}</button>
      </div>

      {/* Add/Edit Employee Modal */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingEmployee ? (language === 'vi' ? 'Chỉnh sửa nhân viên' : 'Edit Employee') : (language === 'vi' ? 'Thêm nhân viên mới' : 'Add New Employee')}</h3>
              <button onClick={() => { setShowAddEmployee(false); setEditingEmployee(null); setEmployeeFormError(''); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.employee_name || 'Họ tên'}</label><input type="text" value={employeeForm.name} onChange={e => setEmployeeForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.phone_number}</label><input type="text" value={employeeForm.phone} onChange={e => setEmployeeForm(p => ({ ...p, phone: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email</label><input type="email" value={employeeForm.email} onChange={e => setEmployeeForm(p => ({ ...p, email: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Địa chỉ' : 'Address'}</label><input type="text" value={employeeForm.address} onChange={e => setEmployeeForm(p => ({ ...p, address: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.employee_role || 'Chức vụ'}</label>
                <input
                  list="position-suggestions"
                  type="text"
                  value={employeeForm.position}
                  onChange={e => setEmployeeForm(p => ({ ...p, position: e.target.value }))}
                  placeholder={language === 'vi' ? 'Nhập hoặc chọn chức vụ...' : 'Type or select position...'}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                />
                <datalist id="position-suggestions">
                  <option value={t.role_staff || 'Nhân viên'} />
                  <option value={t.role_driver || 'Tài xế'} />
                  <option value={t.role_accountant || 'Kế toán'} />
                  <option value={language === 'vi' ? 'Trợ lý' : 'Assistant'} />
                  <option value={language === 'vi' ? 'Trưởng nhóm' : 'Team Lead'} />
                </datalist>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.employee_permissions || 'Nhóm phân quyền'}</label>
                <select value={employeeForm.role} onChange={e => setEmployeeForm(p => ({ ...p, role: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                  {availableRoles.map(roleId => (
                    <option key={roleId} value={roleId}>{EMPLOYEE_ROLE_LABELS[roleId] || roleId}</option>
                  ))}
                </select>
                <p className="text-[9px] text-gray-400 mt-1 ml-1">{language === 'vi' ? '* Xác định trang được phép truy cập (cấu hình tại Cài đặt → Phân quyền)' : '* Determines accessible pages (configure in Settings → Permissions)'}</p>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.status}</label>
                <select value={employeeForm.status} onChange={e => setEmployeeForm(p => ({ ...p, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                  <option value="ACTIVE">{t.status_active}</option>
                  <option value="INACTIVE">{t.status_locked}</option>
                </select>
              </div>
              <div className="col-span-2 border-t border-gray-100 pt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{language === 'vi' ? 'Tài khoản đăng nhập hệ thống' : 'System Login Credentials'}</p>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.username}</label><input type="text" value={employeeForm.username} onChange={e => { setEmployeeForm(p => ({ ...p, username: e.target.value })); setEmployeeFormError(''); }} className={`w-full mt-1 px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 ${employeeFormError ? 'border-red-400' : 'border-gray-100'}`} />{employeeFormError && <p className="text-xs text-red-500 mt-1 ml-1">{employeeFormError}</p>}</div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mật khẩu' : 'Password'}</label><input type="text" value={employeeForm.password} onChange={e => setEmployeeForm(p => ({ ...p, password: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
            </div>
            <div className="flex justify-end gap-4 pt-2">
              <button onClick={() => { setShowAddEmployee(false); setEditingEmployee(null); setEmployeeFormError(''); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
              <button onClick={handleSaveEmployee} disabled={!employeeForm.name} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingEmployee ? t.save : (t.add_employee || 'Thêm nhân viên')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: t.total_employees || 'Tổng nhân viên', value: filteredEmployees.length, icon: Users, color: 'text-blue-600' },
          { label: t.active_employees || 'Đang làm việc', value: filteredEmployees.filter(e => e.status === 'ACTIVE').length, icon: Users, color: 'text-green-600' },
          { label: t.role_driver || 'Tài xế', value: filteredEmployees.filter(e => e.role === 'DRIVER').length, icon: Truck, color: 'text-orange-500' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                <h3 className="text-2xl font-bold mt-2">{s.value}</h3>
              </div>
              <div className={cn("p-3 rounded-xl bg-gray-50", s.color)}><s.icon size={20} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder={language === 'vi' ? 'Tìm theo tên, SĐT, tài khoản...' : 'Search by name, phone, username...'} value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
          </div>
          <button onClick={() => setShowEmployeeFilters(p => !p)} className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all', showEmployeeFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            <Filter size={15} />
            {language === 'vi' ? 'Lọc theo chức vụ' : 'Filter by Role'}
          </button>
          {(employeeSearch || employeeRoleFilter !== 'ALL') && (
            <button onClick={() => { setEmployeeSearch(''); setEmployeeRoleFilter('ALL'); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all">
              <X size={14} />{language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
            </button>
          )}
        </div>
        {showEmployeeFilters && (
          <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-100">
            {(['ALL', ...availableRoles]).map(r => (
              <button key={r} onClick={() => setEmployeeRoleFilter(r)} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', employeeRoleFilter === r ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                {r === 'ALL' ? (language === 'vi' ? 'Tất cả' : 'All') : (EMPLOYEE_ROLE_LABELS[r] || r)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.employee_name || 'Nhân viên'}</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.employee_role || 'Chức vụ'}</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.employee_permissions || 'Phân quyền'}</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.phone_number}</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.username}</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.status}</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-gray-400 text-sm">
                    {language === 'vi' ? 'Chưa có nhân viên nào. Nhấn "+ Thêm nhân viên" để bắt đầu.' : 'No employees yet. Click "+ Add Employee" to get started.'}
                  </td>
                </tr>
              ) : filteredEmployees.map((emp) => {
                return (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-8 py-5">
                    <p className="font-bold text-gray-800">{emp.name}</p>
                    {emp.email && <p className="text-xs text-gray-400">{emp.email}</p>}
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-bold", EMPLOYEE_ROLE_COLORS[emp.role] || 'bg-gray-100 text-gray-500')}>
                      {emp.position || EMPLOYEE_ROLE_LABELS[emp.role] || emp.role}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    {emp.role ? (
                      <span className={cn("px-3 py-1 rounded-full text-xs font-bold", EMPLOYEE_ROLE_COLORS[emp.role] || 'bg-gray-100 text-gray-500')}>
                        {EMPLOYEE_ROLE_LABELS[emp.role] || emp.role}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-sm text-gray-700">{emp.phone || <span className="text-gray-300">—</span>}</td>
                  <td className="px-8 py-5">
                    {emp.username ? (
                      <div>
                        <p className="text-xs font-bold text-gray-700">User: <span className="text-daiichi-red">{emp.username}</span></p>
                        <p className="text-[10px] text-gray-400">Pass: {emp.password ? '••••••' : <span className="text-gray-300">—</span>}</p>
                      </div>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", emp.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>
                      {emp.status === 'ACTIVE' ? t.status_active : t.status_locked}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex gap-3 items-center">
                      <button onClick={() => handleStartEditEmployee(emp)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button>
                      <button onClick={() => handleDeleteEmployee(emp.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
