import { useState, useRef } from 'react';
import { transportService } from '../services/transportService';
import { Agent, AgentPaymentOption, Employee } from '../types';

/** External dependencies that useAgents needs from App.tsx */
export interface AgentContext {
  agents: Agent[];
  employees: Employee[];
  language: 'vi' | 'en' | 'ja';
}

export const DEFAULT_AGENT_FORM = {
  name: '',
  code: '',
  phone: '',
  email: '',
  address: '',
  commissionRate: 10,
  balance: 0,
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  username: '',
  password: '',
  paymentType: 'POSTPAID' as 'POSTPAID' | 'PREPAID',
  creditLimit: 0,
  depositAmount: 0,
  holdTicketHours: 24,
  allowedPaymentOptions: [] as AgentPaymentOption[],
};

/**
 * useAgents – encapsulates all agent CRUD state and handlers.
 *
 * Usage:
 *   const agentsHook = useAgents(ctx);
 *   // ctx must contain up-to-date agents[], employees[], and language every render.
 */
export function useAgents(ctx: AgentContext) {
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState({ ...DEFAULT_AGENT_FORM });
  const [agentFormError, setAgentFormError] = useState('');

  // Keep a stable ref so async handlers always read the latest context values.
  const ctxRef = useRef<AgentContext>(ctx);
  ctxRef.current = ctx;

  // Stable refs for internal state used inside async closures.
  const agentFormRef = useRef(agentForm);
  agentFormRef.current = agentForm;
  const editingAgentRef = useRef(editingAgent);
  editingAgentRef.current = editingAgent;

  const isUsernameTaken = (
    username: string,
    excludeAgentId?: string,
    excludeEmployeeId?: string,
  ): boolean => {
    const { agents, employees } = ctxRef.current;
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

  const handleSaveAgent = async () => {
    const form = agentFormRef.current;
    const editing = editingAgentRef.current;
    try {
      if (form.username && form.username.trim()) {
        if (isUsernameTaken(form.username, editing?.id, undefined)) {
          setAgentFormError(
            ctxRef.current.language === 'vi'
              ? 'Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác.'
              : 'This username already exists, please choose another.',
          );
          return;
        }
      }
      setAgentFormError('');
      if (editing) {
        await transportService.updateAgent(editing.id, form);
      } else {
        await transportService.addAgent(form);
      }
      setShowAddAgent(false);
      setEditingAgent(null);
      setAgentForm({ ...DEFAULT_AGENT_FORM });
    } catch (err) {
      console.error('Failed to save agent:', err);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (
      !window.confirm(
        ctxRef.current.language === 'vi'
          ? 'Bạn có chắc muốn xóa đại lý này?'
          : 'Delete this agent?',
      )
    )
      return;
    try {
      await transportService.deleteAgent(agentId);
    } catch (err) {
      console.error('Failed to delete agent:', err);
    }
  };

  const handleStartEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: String(agent.name ?? ''),
      code: String(agent.code ?? ''),
      phone: String(agent.phone ?? ''),
      email: String(agent.email ?? ''),
      address: String(agent.address ?? ''),
      commissionRate: agent.commissionRate,
      balance: agent.balance,
      status: agent.status,
      username: String(agent.username ?? ''),
      password: String(agent.password ?? ''),
      paymentType: agent.paymentType ?? 'POSTPAID',
      creditLimit: agent.creditLimit ?? 0,
      depositAmount: agent.depositAmount ?? 0,
      holdTicketHours: agent.holdTicketHours ?? 24,
      allowedPaymentOptions: agent.allowedPaymentOptions ?? [],
    });
    setAgentFormError('');
    setShowAddAgent(true);
  };

  const handleSaveAgentNote = async (agentId: string, note: string) => {
    try {
      await transportService.updateAgent(agentId, { note } as Partial<Agent>);
    } catch (err) {
      console.error('Failed to save agent note:', err);
    }
  };

  return {
    showAddAgent,
    setShowAddAgent,
    editingAgent,
    setEditingAgent,
    agentForm,
    setAgentForm,
    agentFormError,
    setAgentFormError,
    handleSaveAgent,
    handleDeleteAgent,
    handleStartEditAgent,
    handleSaveAgentNote,
  };
}
