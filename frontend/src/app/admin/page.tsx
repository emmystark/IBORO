'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Trash2, MessageSquare, Clock, X, User, ChevronRight, Building2, UserPlus, Shield, ShieldCheck, Crown, Tag, Layers, Plus, Wifi, Globe, Copy, Check, SlidersHorizontal, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { LogoMark } from '@/components/Logo';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface UserType {
  id: string;
  username: string;
  email: string;
  role: string;
  department_id?: string | null;
  company?: string;
  created_at?: string;
  is_deleted?: boolean;
}

interface Role {
  id: string;
  name: string;
  is_builtin: boolean;
}

interface Department {
  id: string;
  name: string;
  head_user_id?: string | null;
}

interface NetworkAccessEntry {
  id: string;
  ip: string;
  label: string;
  created_at?: string;
}

interface Org {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  plan?: string;
  created_at?: string;
}

interface OrgMember {
  user_id: string;
  role: string;
  username?: string;
  email?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: { text: string; source: string; page: number }[];
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  is_deleted?: boolean;
  deletedAt?: string;
  messages?: Message[];
}

// Helper function to make authenticated API calls
const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  return fetch(url, {
    ...options,
    headers,
  });
};

// Message Detail Modal Component
const ConversationDetailModal = ({ 
  conversation, 
  onClose, 
  userId 
}: { 
  conversation: Conversation; 
  onClose: () => void;
  userId: string;
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // If conversation already has messages, use them directly
    if (conversation.messages && conversation.messages.length > 0) {
      setMessages(conversation.messages);
      setLoading(false);
      return;
    }

    const loadMessages = async () => {
      try {
        setLoading(true);
        setError('');
        
        const res = await authenticatedFetch(
          `${API}/api/admin/users/${userId}/conversations/${conversation.id}`
        );
        
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        } else {
          const errorData = await res.json();
          setError(errorData.detail || 'Failed to load messages');
        }
      } catch {
        setError('Error loading conversation details');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [conversation.id, userId, conversation.messages]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="card-bordered max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-[var(--line)] flex items-start justify-between">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-[var(--ink)] mb-2">{conversation.title}</h2>
            <div className="flex items-center gap-4 text-sm text-[var(--ink-soft)]">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{new Date(conversation.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                <span>{messages.length} messages</span>
              </div>
            </div>
            {conversation.is_deleted && (
              <div className="mt-2">
                <span className="badge-outline border-[var(--danger-border)] text-[var(--danger-text)]">
                  Deleted {conversation.deletedAt ? new Date(conversation.deletedAt).toLocaleString() : ''}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-[var(--surface-2)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--ink-soft)]" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[var(--ink-soft)]">Loading messages...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[var(--danger-text)]">{error}</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[var(--ink-soft)]">No messages in this conversation</div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={message.id || index}
                className={message.role === 'user' ? 'flex justify-end' : ''}
              >
                <div className={`max-w-2xl ${message.role === 'user' ? '' : 'w-full'}`}>
                  <div className={`px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user' ? 'bubble-user' : 'bubble-assistant'
                  }`}>
                    {message.content}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 px-1">
                    <p className="text-xs text-[var(--ink-soft)]">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--line)]">
          <button
            onClick={onClose}
            className="btn-outline w-full px-4 py-2 text-sm font-medium text-[var(--ink)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface NetworkAccessPanelProps {
  entries: NetworkAccessEntry[];
  loading: boolean;
  error: string;
  tailscaleRange: string;
  serverIp: string;
  gatewayPort: number;
  gatewayScheme: string;
  form: { ip: string; label: string };
  setForm: (updater: (prev: { ip: string; label: string }) => { ip: string; label: string }) => void;
  adding: boolean;
  onAdd: (e: React.FormEvent) => void;
  onDelete: (entry: NetworkAccessEntry) => void;
}

const NetworkAccessPanel = ({
  entries, loading, error, tailscaleRange, serverIp, gatewayPort, gatewayScheme, form, setForm, adding, onAdd, onDelete,
}: NetworkAccessPanelProps) => {
  const [copied, setCopied] = useState(false);

  // serverIp comes from the backend (the machine's actual LAN address) so
  // this is correct no matter what host the admin used to open this page -
  // window.location.hostname would show "localhost" if that's how they got
  // here, which is useless to hand to another device.
  const shareLink = serverIp ? `${gatewayScheme || 'https'}://${serverIp}:${gatewayPort}` : '';

  const handleCopy = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="font-display text-xl font-bold mb-1 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[var(--accent)]" /> Network access
        </h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Only the devices below can open the link. Everyone else gets blocked before they ever see a login screen.
        </p>
      </div>

      {/* Shareable link */}
      <div className="card-bordered p-5">
        <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)] mb-2">Shareable link</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate bg-[var(--surface-2)] px-3 py-2 text-sm rounded">{shareLink || '…'}</code>
          <button
            onClick={handleCopy}
            className="btn-outline flex items-center gap-1.5 px-3 py-2 text-sm shrink-0"
            title="Copy link"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-[var(--ink-soft)] mt-2">
          Send this to your team. It only works from a device or network listed below.
        </p>
        {gatewayScheme === 'https' && (
          <div className="mt-3 pt-3 border-t border-[var(--line)]">
            <p className="text-xs text-[var(--ink-soft)]">
              This is a private HTTPS certificate generated on this machine, not a public one - every device sees a one-time browser warning the first time it opens the link (choose &quot;Advanced&quot; / &quot;Show Details&quot; then &quot;Proceed&quot; / &quot;visit this website&quot; - wording varies by browser). To make it a clean padlock instead, download the certificate below and install it once per device (send it via AirDrop, email, or Slack):
            </p>
            <a
              href={`${API}/api/admin/gateway-certificate`}
              onClick={(e) => {
                e.preventDefault();
                fetch(`${API}/api/admin/gateway-certificate`, {
                  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}` },
                })
                  .then((r) => r.blob())
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'iboro-gateway-ca.crt';
                    a.click();
                    URL.revokeObjectURL(url);
                  });
              }}
              className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs mt-2"
            >
              <Copy className="w-3 h-3" /> Download certificate
            </a>
            <p className="text-xs text-[var(--ink-soft)] mt-2">
              <strong>Mac:</strong> double-click the file, add to keychain, then set it to &quot;Always Trust&quot; in Keychain Access. <strong>Windows:</strong> double-click, Install Certificate, Local Machine, place in &quot;Trusted Root Certification Authorities&quot;. <strong>iPhone/iPad:</strong> AirDrop or email it to the device, install the profile in Settings, then also enable it under Settings &gt; General &gt; About &gt; Certificate Trust Settings. <strong>Android:</strong> install via Settings &gt; Security &gt; Encryption &gt; Install a certificate.
            </p>
          </div>
        )}
      </div>

      {/* On-site devices */}
      <div>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-[var(--accent)]" /> On-site &amp; office devices
        </h3>
        <p className="text-sm text-[var(--ink-soft)] mb-4">
          For people working from a fixed location - the office, a home network. Add the device&apos;s (or router&apos;s) IP address.
          Ask &quot;what&apos;s my IP&quot; or check the router&apos;s connected-devices list to find it.
        </p>

        {error && (
          <div className="mb-3 p-3 border border-[var(--danger-border)] bg-[var(--danger-bg)] rounded">
            <p className="text-[var(--danger-text)] text-xs">{error}</p>
          </div>
        )}

        <form onSubmit={onAdd} className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            placeholder="Label (e.g. Main office)"
            className="input-bordered px-3 py-2 text-sm flex-1"
          />
          <input
            value={form.ip}
            onChange={(e) => setForm((p) => ({ ...p, ip: e.target.value }))}
            placeholder="IP address (e.g. 192.168.1.42)"
            className="input-bordered px-3 py-2 text-sm flex-1"
          />
          <button
            type="submit"
            disabled={adding || !form.ip.trim()}
            className="btn-accent flex items-center gap-1.5 px-4 py-2 text-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>

        <div className="space-y-2">
          {loading ? (
            <p className="text-[var(--ink-soft)] text-sm">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-[var(--ink-soft)] text-sm">No devices added yet - nobody can reach the link until you add one.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="p-3 card-bordered flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[var(--ink)] truncate">{entry.label}</p>
                  <p className="text-xs text-[var(--ink-soft)] font-mono">{entry.ip}</p>
                </div>
                <button
                  onClick={() => onDelete(entry)}
                  className="p-1.5 rounded hover:bg-[var(--danger-bg)] text-[var(--ink-soft)] hover:text-[var(--danger-text)] transition-colors shrink-0"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Remote / roaming devices */}
      <div>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--accent)]" /> Remote &amp; roaming devices
        </h3>
        <p className="text-sm text-[var(--ink-soft)] mb-3">
          For people working from anywhere - home, a coffee shop, another city - whose IP address changes as they move.
          These devices connect through <strong>Tailscale</strong>, a free private network app, instead of being added by IP here.
        </p>
        <div className="card-bordered p-4 space-y-2">
          <p className="text-sm text-[var(--ink)]">
            <span className="badge-outline mr-2">Automatically trusted</span>
            any device signed into your Tailscale network
          </p>
          <p className="text-xs text-[var(--ink-soft)] font-mono">{tailscaleRange || '100.64.0.0/10'}</p>
          <p className="text-sm text-[var(--ink-soft)]">
            To add a remote teammate: have them install Tailscale and sign in, then approve their device once in the{' '}
            <a
              href="https://login.tailscale.com/admin/machines"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[var(--accent)]"
            >
              Tailscale admin console
            </a>
            . Their access keeps working no matter how their IP changes afterwards - no need to touch this page again.
          </p>
        </div>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [userConversations, setUserConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [resetPwMsg, setResetPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<'users' | 'orgs' | 'roles' | 'departments' | 'network'>('users');

  // Organizations
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ username: '', email: '', password: '', role: 'member' });
  const [inviting, setInviting] = useState(false);

  // Roles & Departments (shared across the Users/Roles/Departments tabs)
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);

  // Network access (Caddy gateway allowlist)
  const [networkEntries, setNetworkEntries] = useState<NetworkAccessEntry[]>([]);
  const [tailscaleRange, setTailscaleRange] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [gatewayPort, setGatewayPort] = useState(8443);
  const [gatewayScheme, setGatewayScheme] = useState('https');
  const [networkLoading, setNetworkLoading] = useState(false);
  const [newNetworkForm, setNewNetworkForm] = useState({ ip: '', label: '' });
  const [addingNetworkEntry, setAddingNetworkEntry] = useState(false);
  const [networkError, setNetworkError] = useState('');

  // Create-user form (Users tab)
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    username: '', email: '', password: '', role: 'user', department_id: '',
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = localStorage.getItem('user');
        if (!user) {
          window.location.href = '/login';
          return;
        }
        const parsedUser = JSON.parse(user);
        if (parsedUser.role !== 'admin') {
          window.location.href = '/chat';
          return;
        }
        setCurrentUser(parsedUser);
      } catch {
        window.location.href = '/login';
      } finally {
        setAuthChecked(true);
      }
    };
    
    checkAuth();
  }, []);

  // Load all users
  useEffect(() => {
    if (!authChecked || !currentUser) return;

    const loadUsers = async () => {
      try {
        setLoading(true);
        const res = await authenticatedFetch(`${API}/api/admin/users`);
        if (res.ok) {
          const data = await res.json();
          setUsers(Array.isArray(data) ? data : data.users || []);
        } else if (res.status === 401) {
          window.location.href = '/login';
        }
      } catch {
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [authChecked, currentUser]);

  // Load roles & departments (used by Roles/Departments tabs and the
  // create-user / edit-user role+department selects)
  useEffect(() => {
    if (!authChecked || !currentUser) return;

    const loadRolesAndDepartments = async () => {
      try {
        const [rolesRes, deptsRes] = await Promise.all([
          authenticatedFetch(`${API}/api/roles`),
          authenticatedFetch(`${API}/api/departments`),
        ]);
        if (rolesRes.ok) setRoles((await rolesRes.json()).roles || []);
        if (deptsRes.ok) setDepartments((await deptsRes.json()).departments || []);
      } catch {
        setError('Failed to load roles/departments');
      }
    };

    loadRolesAndDepartments();
  }, [authChecked, currentUser]);

  // Load network access allowlist (Network Access tab)
  useEffect(() => {
    if (!authChecked || !currentUser || tab !== 'network') return;

    const loadNetworkAccess = async () => {
      try {
        setNetworkLoading(true);
        const res = await authenticatedFetch(`${API}/api/admin/network-access`);
        if (res.ok) {
          const data = await res.json();
          setNetworkEntries(data.entries || []);
          setTailscaleRange(data.tailscale_range || '');
          setServerIp(data.server_ip || '');
          setGatewayPort(data.gateway_port || 8443);
          setGatewayScheme(data.gateway_scheme || 'https');
        }
      } catch {
        setNetworkError('Failed to load network access list');
      } finally {
        setNetworkLoading(false);
      }
    };

    loadNetworkAccess();
  }, [authChecked, currentUser, tab]);

  // Reset the password-reset mini-form whenever the selected user changes,
  // so a stale value/message from one user never leaks into another's panel.
  useEffect(() => {
    setResetPwOpen(false);
    setResetPwValue('');
    setResetPwMsg(null);
  }, [selectedUser?.id]);

  // Load conversations for selected user
  useEffect(() => {
    if (!selectedUser) {
      setUserConversations([]);
      return;
    }

    const loadConversations = async () => {
      try {
        setLoading(true);
        setError('');
        
        const res = await authenticatedFetch(
          `${API}/api/admin/users/${selectedUser.id}/conversations?include_deleted=true`
        );
        
        if (res.ok) {
          const data = await res.json();
          
          // Handle both array format and object format
          let convArray: Conversation[] = [];
          if (Array.isArray(data)) {
            convArray = data;
          } else if (typeof data === 'object') {
            // Convert object with conversation IDs as keys to array
            convArray = Object.values(data) as Conversation[];
          }
          
          // Sort by createdAt descending (most recent first)
          convArray.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setUserConversations(convArray);
        } else {
          const errorData = await res.json();
          setError(`Failed to load conversations: ${errorData.detail || 'Unknown error'}`);
        }
      } catch {
        setError('Error loading conversations');
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [selectedUser]);

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      const res = await authenticatedFetch(`${API}/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
        if (selectedUser?.id === userId) {
          setSelectedUser(null);
        }
      } else {
        setError('Failed to delete user');
      }
    } catch {
      setError('Error deleting user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (resetPwValue.length < 8) {
      setResetPwMsg({ type: 'error', text: 'New password must be at least 8 characters' });
      return;
    }
    setResettingPw(true);
    setResetPwMsg(null);
    try {
      const res = await authenticatedFetch(`${API}/api/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: resetPwValue }),
      });
      if (res.ok) {
        setResetPwMsg({ type: 'success', text: `Password reset for ${selectedUser.username}.` });
        setResetPwValue('');
        setResetPwOpen(false);
      } else {
        const err = await res.json();
        setResetPwMsg({ type: 'error', text: err.detail || 'Failed to reset password' });
      }
    } catch {
      setResetPwMsg({ type: 'error', text: 'Error resetting password' });
    } finally {
      setResettingPw(false);
    }
  };

  const handleViewConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  // ── Roles ──────────────────────────────────────────────────────────────

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    setError('');
    try {
      const res = await authenticatedFetch(`${API}/api/roles`, {
        method: 'POST',
        body: JSON.stringify({ name: newRoleName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setRoles((prev) => [...prev, data.role]);
        setNewRoleName('');
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to create role');
      }
    } catch {
      setError('Error creating role');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    const affected = users.filter((u) => u.role === role.id).length;
    const warning = affected > 0
      ? `Delete role "${role.name}"? ${affected} user(s) with this role will be reassigned to "User".`
      : `Delete role "${role.name}"?`;
    if (!confirm(warning)) return;
    try {
      const res = await authenticatedFetch(`${API}/api/roles/${role.id}`, { method: 'DELETE' });
      if (res.ok) {
        setRoles((prev) => prev.filter((r) => r.id !== role.id));
        setUsers((prev) => prev.map((u) => (u.role === role.id ? { ...u, role: 'user' } : u)));
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to delete role');
      }
    } catch {
      setError('Error deleting role');
    }
  };

  // ── Departments ────────────────────────────────────────────────────────

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setCreatingDept(true);
    setError('');
    try {
      const res = await authenticatedFetch(`${API}/api/departments`, {
        method: 'POST',
        body: JSON.stringify({ name: newDeptName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments((prev) => [...prev, data.department]);
        setNewDeptName('');
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to create department');
      }
    } catch {
      setError('Error creating department');
    } finally {
      setCreatingDept(false);
    }
  };

  const handleSetDepartmentHead = async (departmentId: string, headUserId: string) => {
    try {
      const res = await authenticatedFetch(`${API}/api/departments/${departmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ head_user_id: headUserId || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments((prev) => prev.map((d) => (d.id === departmentId ? data.department : d)));
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to set department head');
      }
    } catch {
      setError('Error setting department head');
    }
  };

  const handleDeleteDepartment = async (department: Department) => {
    if (!confirm(`Delete department "${department.name}"? Its documents will be removed too, and its members reassigned to General.`)) return;
    try {
      const res = await authenticatedFetch(`${API}/api/departments/${department.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDepartments((prev) => prev.filter((d) => d.id !== department.id));
        setUsers((prev) => prev.map((u) => (u.department_id === department.id ? { ...u, department_id: null } : u)));
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to delete department');
      }
    } catch {
      setError('Error deleting department');
    }
  };

  // ── Network access ─────────────────────────────────────────────────────

  const handleAddNetworkEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNetworkForm.ip.trim()) return;
    setAddingNetworkEntry(true);
    setNetworkError('');
    try {
      const res = await authenticatedFetch(`${API}/api/admin/network-access`, {
        method: 'POST',
        body: JSON.stringify({ ip: newNetworkForm.ip.trim(), label: newNetworkForm.label.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNetworkEntries((prev) => [...prev, data.entry]);
        setNewNetworkForm({ ip: '', label: '' });
      } else {
        const err = await res.json();
        setNetworkError(err.detail || 'Failed to add entry');
      }
    } catch {
      setNetworkError('Error adding entry');
    } finally {
      setAddingNetworkEntry(false);
    }
  };

  const handleDeleteNetworkEntry = async (entry: NetworkAccessEntry) => {
    if (!confirm(`Remove "${entry.label}" (${entry.ip}) from the allowlist? Devices at this address will lose access immediately.`)) return;
    try {
      const res = await authenticatedFetch(`${API}/api/admin/network-access/${entry.id}`, { method: 'DELETE' });
      if (res.ok) {
        setNetworkEntries((prev) => prev.filter((e) => e.id !== entry.id));
      } else {
        const err = await res.json();
        setNetworkError(err.detail || 'Failed to remove entry');
      }
    } catch {
      setNetworkError('Error removing entry');
    }
  };

  // ── Users: create + edit role/department ──────────────────────────────

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUserForm.username.trim() || !createUserForm.password) return;
    setCreatingUser(true);
    setError('');
    try {
      const res = await authenticatedFetch(`${API}/api/admin/users`, {
        method: 'POST',
        body: JSON.stringify({
          username: createUserForm.username.trim(),
          email: createUserForm.email.trim(),
          password: createUserForm.password,
          role: createUserForm.role,
          department_id: createUserForm.department_id || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => [...prev, data.user]);
        setCreateUserForm({ username: '', email: '', password: '', role: 'user', department_id: '' });
        setCreateUserOpen(false);
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to create user');
      }
    } catch {
      setError('Error creating user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateSelectedUser = async (updates: Partial<Pick<UserType, 'role' | 'department_id'>>) => {
    if (!selectedUser) return;
    try {
      const res = await authenticatedFetch(`${API}/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data.user);
        setUsers((prev) => prev.map((u) => (u.id === data.user.id ? data.user : u)));
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to update user');
      }
    } catch {
      setError('Error updating user');
    }
  };

  // Load organizations
  useEffect(() => {
    if (!authChecked || !currentUser || tab !== 'orgs') return;

    const loadOrgs = async () => {
      try {
        setOrgLoading(true);
        setOrgError('');
        const res = await authenticatedFetch(`${API}/api/orgs`);
        if (res.ok) {
          const data = await res.json();
          const list: Org[] = data.orgs || [];
          setOrgs(list);
          setSelectedOrgId((prev) => prev ?? list[0]?.id ?? null);
        } else {
          setOrgError('Failed to load organizations');
        }
      } catch {
        setOrgError('Error loading organizations');
      } finally {
        setOrgLoading(false);
      }
    };

    loadOrgs();
  }, [authChecked, currentUser, tab]);

  // Load members for selected org
  useEffect(() => {
    if (!selectedOrgId || tab !== 'orgs') {
      setOrgMembers([]);
      return;
    }

    const loadMembers = async () => {
      try {
        setOrgLoading(true);
        setOrgError('');
        const res = await authenticatedFetch(`${API}/api/orgs/${selectedOrgId}/members`);
        if (res.ok) {
          const data = await res.json();
          setOrgMembers(data.members || []);
        } else {
          setOrgError('Failed to load members');
        }
      } catch {
        setOrgError('Error loading members');
      } finally {
        setOrgLoading(false);
      }
    };

    loadMembers();
  }, [selectedOrgId, tab]);

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? null;
  const canManageOrg = selectedOrg?.role === 'owner' || selectedOrg?.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !inviteForm.username.trim()) return;
    setInviting(true);
    setOrgError('');
    try {
      const res = await authenticatedFetch(`${API}/api/orgs/${selectedOrgId}/invite`, {
        method: 'POST',
        body: JSON.stringify({
          username: inviteForm.username.trim(),
          email: inviteForm.email.trim() || undefined,
          password: inviteForm.password || undefined,
          role: inviteForm.role,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrgMembers((prev) => [
          ...prev.filter((m) => m.user_id !== data.user.id),
          { user_id: data.user.id, role: inviteForm.role, username: data.user.username, email: data.user.email },
        ]);
        setInviteForm({ username: '', email: '', password: '', role: 'member' });
        setInviteOpen(false);
      } else {
        const errData = await res.json();
        setOrgError(errData.detail || 'Failed to invite member');
      }
    } catch {
      setOrgError('Error inviting member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedOrgId) return;
    if (!confirm(`Remove "${memberId}" from this organization?`)) return;
    try {
      const res = await authenticatedFetch(`${API}/api/orgs/${selectedOrgId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setOrgMembers((prev) => prev.filter((m) => m.user_id !== memberId));
      } else {
        const errData = await res.json();
        setOrgError(errData.detail || 'Failed to remove member');
      }
    } catch {
      setOrgError('Error removing member');
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--ink-soft)]">Loading...</p>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--danger-text)]">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      {/* Header */}
      <div className="border-b border-[var(--line)] px-8 py-4 sticky top-0 bg-[var(--paper)] z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.location.href = '/chat'}
              className="p-2 rounded hover:bg-[var(--surface-2)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <LogoMark size={24} />
              <h1 className="font-display text-xl font-bold">Iboro · Admin</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/settings"
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] px-2.5 py-1.5 rounded border border-[var(--line)] hover:border-[var(--ink-soft)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </a>
            <a
              href="/chat"
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] px-2.5 py-1.5 rounded border border-[var(--line)] hover:border-[var(--ink-soft)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to chat</span>
            </a>
            <span className="badge-pill">{currentUser.username}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <button
            onClick={() => setTab('users')}
            className={tab === 'users' ? 'btn-accent flex items-center gap-1.5 px-3 py-1.5 text-sm' : 'btn-outline flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--ink-soft)]'}
          >
            <Users className="w-3.5 h-3.5" /> User management
          </button>
          <button
            onClick={() => setTab('roles')}
            className={tab === 'roles' ? 'btn-accent flex items-center gap-1.5 px-3 py-1.5 text-sm' : 'btn-outline flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--ink-soft)]'}
          >
            <Tag className="w-3.5 h-3.5" /> Roles
          </button>
          <button
            onClick={() => setTab('departments')}
            className={tab === 'departments' ? 'btn-accent flex items-center gap-1.5 px-3 py-1.5 text-sm' : 'btn-outline flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--ink-soft)]'}
          >
            <Layers className="w-3.5 h-3.5" /> Departments
          </button>
          <button
            onClick={() => setTab('orgs')}
            className={tab === 'orgs' ? 'btn-accent flex items-center gap-1.5 px-3 py-1.5 text-sm' : 'btn-outline flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--ink-soft)]'}
          >
            <Building2 className="w-3.5 h-3.5" /> Organizations
          </button>
          <button
            onClick={() => setTab('network')}
            className={tab === 'network' ? 'btn-accent flex items-center gap-1.5 px-3 py-1.5 text-sm' : 'btn-outline flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--ink-soft)]'}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Network access
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-8 mt-4 p-4 border border-[var(--danger-border)] bg-[var(--danger-bg)] rounded">
          <p className="text-[var(--danger-text)] text-sm">{error}</p>
        </div>
      )}

      {tab === 'orgs' ? (
        <div className="flex h-[calc(100vh-128px)]">
          {/* Orgs List */}
          <div className="w-80 border-r border-[var(--line)] p-4 overflow-y-auto">
            <h2 className="font-display font-bold text-[var(--ink)] mb-4">Organizations ({orgs.length})</h2>
            {orgError && (
              <div className="mb-3 p-3 border border-[var(--danger-border)] bg-[var(--danger-bg)] rounded">
                <p className="text-[var(--danger-text)] text-xs">{orgError}</p>
              </div>
            )}
            <div className="space-y-2">
              {orgLoading && orgs.length === 0 ? (
                <p className="text-[var(--ink-soft)] text-sm">Loading organizations...</p>
              ) : orgs.length === 0 ? (
                <p className="text-[var(--ink-soft)] text-sm">No organizations found</p>
              ) : (
                orgs.map((org) => (
                  <div
                    key={org.id}
                    onClick={() => setSelectedOrgId(org.id)}
                    className={`p-3 rounded cursor-pointer transition-all flex items-center gap-3 border ${
                      selectedOrgId === org.id
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-soft-border)]'
                        : 'bg-transparent border-[var(--line)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <div className="w-8 h-8 border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center text-xs font-display font-bold flex-shrink-0">
                      {org.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--ink)] truncate">{org.name}</p>
                      <p className="text-xs text-[var(--ink-soft)] capitalize flex items-center gap-1">
                        {org.role === 'owner' && <Crown className="w-3 h-3" />}
                        {org.role}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Org Members */}
          <div className="flex-1 overflow-y-auto">
            {!selectedOrg ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Building2 className="w-16 h-16 text-[var(--line)] mx-auto mb-4" />
                  <p className="text-[var(--ink-soft)]">Select an organization to manage members</p>
                </div>
              </div>
            ) : (
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="font-display text-2xl font-bold mb-1">{selectedOrg.name}</h2>
                    <p className="text-sm text-[var(--ink-soft)] capitalize">Your role: {selectedOrg.role}</p>
                  </div>
                  {canManageOrg && (
                    <button
                      onClick={() => setInviteOpen((s) => !s)}
                      className="btn-accent flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <UserPlus className="w-4 h-4" /> Invite member
                    </button>
                  )}
                </div>

                {inviteOpen && (
                  <form
                    onSubmit={handleInvite}
                    className="mb-6 p-5 card-bordered grid grid-cols-2 gap-3"
                  >
                    <input
                      value={inviteForm.username}
                      onChange={(e) => setInviteForm((p) => ({ ...p, username: e.target.value }))}
                      placeholder="Username (existing or new)"
                      required
                      className="input-bordered px-3 py-2 text-sm"
                    />
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                      className="input-bordered px-3 py-2 text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <input
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email (required for new users)"
                      type="email"
                      className="input-bordered px-3 py-2 text-sm"
                    />
                    <input
                      value={inviteForm.password}
                      onChange={(e) => setInviteForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Password (required for new users)"
                      type="password"
                      className="input-bordered px-3 py-2 text-sm"
                    />
                    <div className="col-span-2 flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={inviting || !inviteForm.username.trim()}
                        className="btn-accent px-4 py-2 text-sm"
                      >
                        {inviting ? 'Inviting…' : 'Send invite'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteOpen(false)}
                        className="btn-outline px-4 py-2 text-sm text-[var(--ink-soft)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[var(--accent)]" />
                  Members ({orgMembers.length})
                </h3>
                <div className="space-y-2">
                  {orgLoading ? (
                    <p className="text-[var(--ink-soft)] text-sm">Loading members...</p>
                  ) : (
                    orgMembers.map((m) => (
                      <div
                        key={m.user_id}
                        className="p-4 card-bordered flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center">
                            <User className="w-4 h-4 text-[var(--ink-soft)]" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-[var(--ink)]">{m.username || m.user_id}</p>
                            <p className="text-xs text-[var(--ink-soft)]">{m.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="badge-outline capitalize flex items-center gap-1">
                            {m.role === 'owner' && <Crown className="w-3 h-3" />}
                            {m.role}
                          </span>
                          {canManageOrg && m.role !== 'owner' && (
                            <button
                              onClick={() => handleRemoveMember(m.user_id)}
                              className="p-1.5 rounded hover:bg-[var(--danger-bg)] text-[var(--ink-soft)] hover:text-[var(--danger-text)] transition-colors"
                              title="Remove member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : tab === 'roles' ? (
        <div className="p-4 md:p-8 max-w-2xl mx-auto">
          <h2 className="font-display text-xl font-bold mb-1">Roles</h2>
          <p className="text-sm text-[var(--ink-soft)] mb-6">
            Custom roles are simple labels for organizing people - they get the same basic access as &quot;User&quot;.
            Admin and Manager are built in and can&apos;t be changed.
          </p>

          <form onSubmit={handleCreateRole} className="flex gap-2 mb-6">
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="New role name (e.g. Sales Rep)"
              className="input-bordered flex-1 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creatingRole || !newRoleName.trim()}
              className="btn-accent flex items-center gap-1.5 px-4 py-2 text-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Add role
            </button>
          </form>

          <div className="space-y-2">
            {roles.map((role) => (
              <div key={role.id} className="p-4 card-bordered flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm text-[var(--ink)] truncate">{role.name}</span>
                  {role.is_builtin && <span className="badge-outline shrink-0">Protected</span>}
                </div>
                {!role.is_builtin && (
                  <button
                    onClick={() => handleDeleteRole(role)}
                    className="p-1.5 rounded hover:bg-[var(--danger-bg)] text-[var(--ink-soft)] hover:text-[var(--danger-text)] transition-colors shrink-0"
                    title="Delete role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'departments' ? (
        <div className="p-4 md:p-8 max-w-2xl mx-auto">
          <h2 className="font-display text-xl font-bold mb-1">Departments</h2>
          <p className="text-sm text-[var(--ink-soft)] mb-6">
            Each department&apos;s documents are private to its members. Assign a head to let them upload for their team.
            &quot;General&quot; (company-wide) is always available and isn&apos;t listed here - only admins/managers upload to it.
          </p>

          <form onSubmit={handleCreateDepartment} className="flex gap-2 mb-6">
            <input
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="New department name (e.g. Sales)"
              className="input-bordered flex-1 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creatingDept || !newDeptName.trim()}
              className="btn-accent flex items-center gap-1.5 px-4 py-2 text-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Add department
            </button>
          </form>

          <div className="space-y-2">
            {departments.length === 0 ? (
              <p className="text-[var(--ink-soft)] text-sm">No departments yet</p>
            ) : (
              departments.map((dept) => (
                <div key={dept.id} className="p-4 card-bordered flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="font-medium text-sm text-[var(--ink)] flex-1 min-w-0 truncate">{dept.name}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={dept.head_user_id || ''}
                      onChange={(e) => handleSetDepartmentHead(dept.id, e.target.value)}
                      className="input-bordered px-2 py-1.5 text-xs flex-1 sm:flex-none sm:w-40"
                    >
                      <option value="">No head assigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.username}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDeleteDepartment(dept)}
                      className="p-1.5 rounded hover:bg-[var(--danger-bg)] text-[var(--ink-soft)] hover:text-[var(--danger-text)] transition-colors shrink-0"
                      title="Delete department"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : tab === 'network' ? (
        <NetworkAccessPanel
          entries={networkEntries}
          loading={networkLoading}
          error={networkError}
          tailscaleRange={tailscaleRange}
          serverIp={serverIp}
          gatewayPort={gatewayPort}
          gatewayScheme={gatewayScheme}
          form={newNetworkForm}
          setForm={setNewNetworkForm}
          adding={addingNetworkEntry}
          onAdd={handleAddNetworkEntry}
          onDelete={handleDeleteNetworkEntry}
        />
      ) : (
      <div className="flex flex-col md:flex-row h-[calc(100vh-128px)]">
        {/* Users List - hidden on mobile once a user is selected, so the
            detail panel gets the full screen instead of a squeezed split */}
        <div className={`w-full md:w-80 md:border-r border-[var(--line)] p-4 overflow-y-auto ${selectedUser ? 'hidden md:block' : ''}`}>
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="font-display font-bold text-[var(--ink)]">Users ({users.length})</h2>
            <button
              onClick={() => setCreateUserOpen((s) => !s)}
              className="btn-outline flex items-center gap-1 px-2.5 py-1.5 text-xs shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" /> New
            </button>
          </div>

          {createUserOpen && (
            <form onSubmit={handleCreateUser} className="mb-4 p-3 card-bordered space-y-2">
              <input
                value={createUserForm.username}
                onChange={(e) => setCreateUserForm((p) => ({ ...p, username: e.target.value }))}
                placeholder="Username" required
                className="input-bordered w-full px-2.5 py-1.5 text-xs"
              />
              <input
                value={createUserForm.email}
                onChange={(e) => setCreateUserForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email" type="email"
                className="input-bordered w-full px-2.5 py-1.5 text-xs"
              />
              <input
                value={createUserForm.password}
                onChange={(e) => setCreateUserForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Password" type="password" required
                className="input-bordered w-full px-2.5 py-1.5 text-xs"
              />
              <select
                value={createUserForm.role}
                onChange={(e) => setCreateUserForm((p) => ({ ...p, role: e.target.value }))}
                className="input-bordered w-full px-2.5 py-1.5 text-xs"
              >
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select
                value={createUserForm.department_id}
                onChange={(e) => setCreateUserForm((p) => ({ ...p, department_id: e.target.value }))}
                className="input-bordered w-full px-2.5 py-1.5 text-xs"
              >
                <option value="">General only (no department)</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creatingUser || !createUserForm.username.trim() || !createUserForm.password}
                  className="btn-accent flex-1 px-3 py-1.5 text-xs"
                >
                  {creatingUser ? 'Creating…' : 'Create user'}
                </button>
                <button type="button" onClick={() => setCreateUserOpen(false)} className="btn-outline px-3 py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {loading && users.length === 0 ? (
              <p className="text-[var(--ink-soft)] text-sm">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-[var(--ink-soft)] text-sm">No users found</p>
            ) : (
              users.map(user => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`p-3 rounded cursor-pointer transition-all group border ${
                    selectedUser?.id === user.id
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-soft-border)]'
                      : 'bg-transparent border-[var(--line)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-[var(--ink)]">{user.username}</p>
                      <p className="text-xs text-[var(--ink-soft)] mt-1">{user.email}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {(user.role === 'admin' || user.role === 'manager') && (
                          <span className="badge-pill capitalize">{user.role}</span>
                        )}
                        {user.department_id && (
                          <span className="badge-outline">
                            {departments.find((d) => d.id === user.department_id)?.name || user.department_id}
                          </span>
                        )}
                      </div>
                    </div>
                    {user.id !== currentUser.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUser(user.id, user.username);
                        }}
                        className="p-1 rounded hover:bg-[var(--danger-bg)] text-[var(--ink-soft)] hover:text-[var(--danger-text)] transition-colors opacity-50 group-hover:opacity-100"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* User Details and Conversations */}
        <div className="flex-1 overflow-y-auto">
          {!selectedUser ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Users className="w-16 h-16 text-[var(--line)] mx-auto mb-4" />
                <p className="text-[var(--ink-soft)]">Select a user to view their conversations</p>
              </div>
            </div>
          ) : (
            <div className="p-4 md:p-8">
              <button
                onClick={() => setSelectedUser(null)}
                className="md:hidden flex items-center gap-1.5 text-sm text-[var(--ink-soft)] mb-4"
              >
                <ArrowLeft className="w-4 h-4" /> Back to users
              </button>

              <div className="mb-8">
                <h2 className="font-display text-2xl font-bold mb-4">{selectedUser.username}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 card-bordered">
                    <p className="text-xs text-[var(--ink-soft)] mb-1">Email</p>
                    <p className="text-sm text-[var(--ink)]">{selectedUser.email}</p>
                  </div>
                  <div className="p-4 card-bordered">
                    <p className="text-xs text-[var(--ink-soft)] mb-1">Joined</p>
                    <p className="text-sm text-[var(--ink)]">
                      {selectedUser.created_at
                        ? new Date(selectedUser.created_at).toLocaleDateString()
                        : 'N/A'
                      }
                    </p>
                  </div>
                  <div className="p-4 card-bordered">
                    <p className="text-xs text-[var(--ink-soft)] mb-1">Role</p>
                    {selectedUser.id === currentUser.id ? (
                      <p className="text-sm text-[var(--ink)] capitalize">{selectedUser.role} (you)</p>
                    ) : (
                      <select
                        value={selectedUser.role}
                        onChange={(e) => handleUpdateSelectedUser({ role: e.target.value })}
                        className="input-bordered w-full px-2 py-1.5 text-sm mt-0.5"
                      >
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="p-4 card-bordered">
                    <p className="text-xs text-[var(--ink-soft)] mb-1">Department</p>
                    <select
                      value={selectedUser.department_id || ''}
                      onChange={(e) => handleUpdateSelectedUser({ department_id: e.target.value || null })}
                      className="input-bordered w-full px-2 py-1.5 text-sm mt-0.5"
                    >
                      <option value="">General only (no department)</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mb-8 p-4 card-bordered">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="w-4 h-4 text-[var(--ink-soft)]" />
                  <h3 className="font-display text-sm font-bold text-[var(--ink)]">Password reset</h3>
                </div>

                {selectedUser.id === currentUser.id ? (
                  <p className="text-sm text-[var(--ink-soft)] mt-1">
                    Use Settings → Security to change your own password.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-[var(--ink-soft)] mt-1 mb-3">
                      Set a new password for {selectedUser.username} without needing their current one -
                      for when they've forgotten it. This doesn&apos;t replace their own change-password flow.
                    </p>

                    {resetPwMsg && (
                      <div
                        className={`flex items-center gap-2 mb-3 px-3 py-2 rounded text-sm ${
                          resetPwMsg.type === 'success'
                            ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-soft-border)]'
                            : 'bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger-border)]'
                        }`}
                      >
                        {resetPwMsg.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        )}
                        {resetPwMsg.text}
                      </div>
                    )}

                    {resetPwOpen ? (
                      <form onSubmit={handleResetPassword} className="flex flex-col sm:flex-row gap-2 items-start">
                        <div className="flex-1 w-full">
                          <input
                            type="password"
                            required
                            minLength={8}
                            autoFocus
                            value={resetPwValue}
                            onChange={(e) => setResetPwValue(e.target.value)}
                            placeholder="New password (min. 8 characters)"
                            className="input-bordered w-full px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button type="submit" disabled={resettingPw} className="btn-accent px-4 py-2 text-sm">
                            {resettingPw ? 'Resetting…' : 'Reset'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setResetPwOpen(false); setResetPwValue(''); }}
                            className="btn-outline px-4 py-2 text-sm text-[var(--ink)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button onClick={() => setResetPwOpen(true)} className="btn-outline px-4 py-2 text-sm text-[var(--ink)]">
                        Reset password
                      </button>
                    )}
                  </>
                )}
              </div>

              <div>
                <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[var(--accent)]" />
                  Conversations ({userConversations.length})
                </h3>
                <div className="space-y-2">
                  {loading ? (
                    <p className="text-[var(--ink-soft)] text-sm">Loading conversations...</p>
                  ) : userConversations.length === 0 ? (
                    <div className="p-8 text-center">
                      <MessageSquare className="w-12 h-12 text-[var(--line)] mx-auto mb-3" />
                      <p className="text-[var(--ink-soft)] text-sm">No conversations yet</p>
                    </div>
                  ) : (
                    userConversations.map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => handleViewConversation(conv)}
                        className={`p-4 rounded border transition-all cursor-pointer group ${
                          conv.is_deleted
                            ? 'bg-[var(--danger-bg)] border-[var(--danger-border)] hover:bg-[var(--danger-bg-hover)]'
                            : 'card-bordered hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-[var(--ink)] mb-2">{conv.title}</p>
                            <div className="flex items-center gap-3 text-xs text-[var(--ink-soft)]">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(conv.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                            {conv.is_deleted && (
                              <div className="mt-2">
                                <span className="badge-outline border-[var(--danger-border)] text-[var(--danger-text)]">
                                  Deleted {conv.deletedAt ? new Date(conv.deletedAt).toLocaleString() : ''}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {conv.is_deleted && (
                              <span className="badge-outline border-[var(--danger-border)] text-[var(--danger-text)]">Deleted</span>
                            )}
                            <ChevronRight className="w-5 h-5 text-[var(--ink-soft)] group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Conversation Detail Modal */}
      {selectedConversation && selectedUser && (
        <ConversationDetailModal
          conversation={selectedConversation}
          userId={selectedUser.id}
          onClose={() => setSelectedConversation(null)}
        />
      )}
    </div>
  );
}