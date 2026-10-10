import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  UserX,
  UserCheck,
  Trash2,
  Mail,
  Clock,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  Info,
  Lock,
  Sliders,
  ChevronDown,
  Copy,
  Link,
  Share2,
  Check,
  Ban
} from 'lucide-react';
import { ClinicMember, ClinicRole, ClinicPermission, ClinicAuditLog, ClinicInvitation } from '../types';
import {
  subscribeToClinicMembers,
  inviteClinicMember,
  updateClinicMemberRole,
  updateClinicMemberPermissions,
  setClinicMemberStatus,
  removeClinicMember,
  getClinicAuditLogs,
  subscribeToPendingInvitations,
  revokeClinicInvitation
} from '../services/firebaseService';
import {
  ROLE_LABELS_AR,
  ROLE_DESCRIPTIONS_AR,
  ROLE_PERMISSIONS,
  ALL_CLINIC_PERMISSIONS,
  hasPermission
} from '../utils/permissions';

interface ClinicTeamManagerProps {
  currentMember: ClinicMember | null;
  organizationId: string;
  isDoctorOwnerFallback?: boolean;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const ClinicTeamManager: React.FC<ClinicTeamManagerProps> = ({
  currentMember,
  organizationId,
  isDoctorOwnerFallback = false,
  onShowToast
}) => {
  const [members, setMembers] = useState<ClinicMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'audit'>('members');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<ClinicAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Pending Invitations State
  const [pendingInvitations, setPendingInvitations] = useState<ClinicInvitation[]>([]);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ClinicRole>('SECRETARY');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  // Custom Permissions Modal State
  const [editingPermissionsMember, setEditingPermissionsMember] = useState<ClinicMember | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<ClinicPermission[]>([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Check permissions
  const canManageMembers = hasPermission(currentMember, 'MANAGE_MEMBERS', isDoctorOwnerFallback);

  // Real-time Members Subscription
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToClinicMembers(organizationId, (mList) => {
      setMembers(mList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [organizationId]);

  // Real-time Pending Invitations Subscription
  useEffect(() => {
    const unsub = subscribeToPendingInvitations(organizationId, (invs) => {
      setPendingInvitations(invs);
    });
    return () => unsub();
  }, [organizationId]);

  // Load Audit Logs when tab changes
  useEffect(() => {
    if (activeSubTab === 'audit') {
      setLoadingAudit(true);
      getClinicAuditLogs(organizationId).then((logs) => {
        setAuditLogs(logs);
        setLoadingAudit(false);
      });
    }
  }, [activeSubTab, organizationId]);

  // Open Permissions Modal for Member
  const handleOpenPermissionsModal = (member: ClinicMember) => {
    setEditingPermissionsMember(member);
    if (Array.isArray(member.customPermissions)) {
      setSelectedPermissions(member.customPermissions);
    } else {
      setSelectedPermissions(ROLE_PERMISSIONS[member.role] || []);
    }
  };

  // Toggle individual permission
  const handleTogglePermission = (permKey: ClinicPermission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  // Reset permissions to Role Defaults
  const handleResetToRoleDefaults = () => {
    if (!editingPermissionsMember) return;
    setSelectedPermissions(ROLE_PERMISSIONS[editingPermissionsMember.role] || []);
  };

  // Save Custom Permissions
  const handleSavePermissions = async () => {
    if (!editingPermissionsMember) return;

    const actor: ClinicMember = currentMember || {
      id: organizationId,
      uid: organizationId,
      organizationId,
      role: 'OWNER',
      displayName: 'مالك العيادة',
      email: '',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setIsSavingPermissions(true);
    try {
      await updateClinicMemberPermissions(actor, editingPermissionsMember.id, selectedPermissions);
      onShowToast(
        "تم حفظ الصلاحيات المخصصة",
        `تم تحديث الصلاحيات الفردية لـ ${editingPermissionsMember.displayName} (${selectedPermissions.length} صلاحية مفعّلة)`,
        "success"
      );
      setEditingPermissionsMember(null);
    } catch (err: any) {
      onShowToast("خطأ في حفظ الصلاحيات", err.message || "تعذر حفظ الصلاحيات المخصصة", "error");
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // Handle Invite / Add Member
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      onShowToast("بيانات غير مكتملة", "يرجى كتابة الاسم والبريد الإلكتروني للموظف", "warning");
      return;
    }

    if (!currentMember && !isDoctorOwnerFallback) {
      onShowToast("غير مصرح", "لا تملك صلاحية إضافة أعضاء", "error");
      return;
    }

    const actor: ClinicMember = currentMember || {
      id: organizationId,
      uid: organizationId,
      organizationId,
      role: 'OWNER',
      displayName: 'مالك العيادة',
      email: '',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setIsSubmittingInvite(true);
    try {
      const inv = await inviteClinicMember(actor, {
        displayName: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        customPermissions: ROLE_PERMISSIONS[inviteRole] || []
      });

      const generatedUrl = `${window.location.origin}${window.location.pathname}?invite=${inv.id}`;
      setCreatedInviteLink(generatedUrl);
      onShowToast("تم إنشاء رابط الدعوة بنجاح", `جاهز للمشاركة مع ${inviteName}`, "success");
    } catch (err: any) {
      console.error("Invite error:", err);
      onShowToast("خطأ في إنشاء الدعوة", err.message || "تعذر إكمال العملية", "error");
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(id);
    onShowToast("تم نسخ رابط الدعوة", "يمكنك إرساله للموظف عبر الواتساب أو البريد", "info");
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!window.confirm("هل أنت تأكد من رغبتك في إلغاء هذه الدعوة المعلقة؟")) return;

    const actor: ClinicMember = currentMember || {
      id: organizationId,
      uid: organizationId,
      organizationId,
      role: 'OWNER',
      displayName: 'مالك العيادة',
      email: '',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    try {
      await revokeClinicInvitation(actor, invitationId);
      onShowToast("تم إلغاء الدعوة بنجاح", "تم تعطيل رابط الدعوة السابقة", "info");
    } catch (err: any) {
      onShowToast("خطأ في إلغاء الدعوة", err.message || "تعذر إلغاء الدعوة", "error");
    }
  };

  // Handle Role Change
  const handleRoleChange = async (member: ClinicMember, newRole: ClinicRole) => {
    if (member.role === newRole) return;

    const actor: ClinicMember = currentMember || {
      id: organizationId,
      uid: organizationId,
      organizationId,
      role: 'OWNER',
      displayName: 'مالك العيادة',
      email: '',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    try {
      await updateClinicMemberRole(actor, member.id, newRole);
      onShowToast("تم تحديث الدور بنجاح", `تم تغيير دور ${member.displayName} إلى ${ROLE_LABELS_AR[newRole]}`, "success");
    } catch (err: any) {
      onShowToast("خطأ في التحديث", err.message || "تعذر تغيير دور العضو", "error");
    }
  };

  // Handle Enable / Disable Status
  const handleToggleStatus = async (member: ClinicMember) => {
    if (member.status === 'invited') {
      onShowToast("غير متاح", "لا يمكن تفعيل عضو لم يقم بقبول الدعوة بعد. يجب على الموظف قبول الدعوة أولاً.", "warning");
      return;
    }

    const actor: ClinicMember = currentMember || {
      id: organizationId,
      uid: organizationId,
      organizationId,
      role: 'OWNER',
      displayName: 'مالك العيادة',
      email: '',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const newStatus = member.status === 'disabled' ? 'active' : 'disabled';
    try {
      await setClinicMemberStatus(actor, member.id, newStatus);
      onShowToast(
        newStatus === 'disabled' ? "تم تعطيل العضو" : "تم إعادة التفعيل",
        newStatus === 'disabled' ? `تم إيقاف صلاحيات ${member.displayName}` : `تم تفعيل حساب ${member.displayName}`,
        newStatus === 'disabled' ? "warning" : "success"
      );
    } catch (err: any) {
      onShowToast("خطأ في تحديث الحالة", err.message || "تعذر تعديل حالة الحساب", "error");
    }
  };

  // Handle Remove Member
  const handleRemoveMember = async (member: ClinicMember) => {
    if (!window.confirm(`هل أنت تأكد من رغبتك في إزالة ${member.displayName} من طاقم العيادة؟`)) return;

    const actor: ClinicMember = currentMember || {
      id: organizationId,
      uid: organizationId,
      organizationId,
      role: 'OWNER',
      displayName: 'مالك العيادة',
      email: '',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    try {
      await removeClinicMember(actor, member.id);
      onShowToast("تم حذف العضو", `تم إزالة ${member.displayName} نهائياً من العيادة`, "info");
    } catch (err: any) {
      onShowToast("خطأ في الحذف", err.message || "تعذر حذف العضو", "error");
    }
  };

  const getRoleBadgeStyle = (role: ClinicRole) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DOCTOR':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'SECRETARY':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'STAFF':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Group permissions by category for modal
  const categories = Array.from(new Set(ALL_CLINIC_PERMISSIONS.map((p) => p.category)));

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
      
      {/* Header & Sub-Tabs */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-sky-50/30 to-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-sky-100 text-sky-700 rounded-xl">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900 font-['Tajawal',sans-serif]">
              فريق العمل وتخصيص الصلاحيات
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            إدارة أعضاء العيادة (أطباء، سكرتارية، كادر إداري) وتحديد صلاحيات كل عضو بشكل فردي ومستقل.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tab navigation */}
          <div className="bg-slate-200/60 p-1 rounded-xl flex items-center text-xs font-bold">
            <button
              onClick={() => setActiveSubTab('members')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeSubTab === 'members'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الأعضاء ({members.length})
            </button>
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                activeSubTab === 'audit'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>سجل الإجراءات</span>
            </button>
          </div>

          {/* Add Member Button */}
          {canManageMembers && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة عضو جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Sub-Tab Content */}
      {activeSubTab === 'members' ? (
        <div className="p-6 space-y-6">

          {/* Pending Invitations Section */}
          {pendingInvitations.length > 0 && canManageMembers && (
            <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-amber-950 font-['Tajawal',sans-serif]">
                    الدعوات المعلقة بانتظار الموافقة ({pendingInvitations.length})
                  </h3>
                </div>
                <span className="text-[11px] text-amber-700 font-medium">
                  تنتهي الدعوات تلقائياً بعد 7 أيام
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingInvitations.map((inv) => {
                  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${inv.id}`;
                  const isCopied = copiedToken === inv.id;

                  return (
                    <div
                      key={inv.id}
                      className="bg-white p-3.5 rounded-xl border border-amber-200/70 shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-amber-600" />
                            <span>{inv.invitedName || 'دعوة موظف'}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate dir-ltr text-left mt-0.5">
                            {inv.invitedEmail}
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-200">
                          {ROLE_LABELS_AR[inv.role] || inv.role}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(inviteUrl, inv.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                          <span>{isCopied ? 'تم النسخ!' : 'نسخ رابط الدعوة'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="px-2 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          title="إلغاء وإبطال رابط الدعوة"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>إلغاء الدعوة</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              جاري تحميل أعضاء العيادة...
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <div className="text-slate-700 font-bold text-sm">لا يوجد أعضاء مضافون حالياً</div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                بصفتك مالك العيادة، يمكنك دعوة الأطباء، السكرتارية، والكادر الإداري للعمل معك على نفس العيادة بنفس البيانات السحابية.
              </p>
              {canManageMembers && (
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="mt-4 px-5 py-2.5 bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-sky-700 transition inline-flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة أول عضو للعيادة</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => {
                const isSelf = currentMember ? currentMember.uid === member.uid : member.uid === organizationId;
                const isOwner = member.role === 'OWNER';
                const hasCustomPerms = Array.isArray(member.customPermissions);
                const activePermsCount = hasCustomPerms
                  ? member.customPermissions!.length
                  : (ROLE_PERMISSIONS[member.role] || []).length;

                return (
                  <div
                    key={member.id}
                    className={`p-5 rounded-2xl border transition relative flex flex-col justify-between ${
                      member.status === 'disabled'
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top Header Card Info */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                            isOwner ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
                          }`}>
                            {member.displayName ? member.displayName.charAt(0) : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <span>{member.displayName}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200">
                                  حسابك
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono truncate max-w-[180px]">
                              {member.email}
                            </div>
                          </div>
                        </div>

                        {/* Status Pill */}
                        <div>
                          {member.status === 'active' && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> نشط
                            </span>
                          )}
                          {member.status === 'invited' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> دعوة معلقة
                            </span>
                          )}
                          {member.status === 'disabled' && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60 inline-flex items-center gap-1">
                              <UserX className="w-3 h-3" /> معطل
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Role Info & Description */}
                      <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-2 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">الدور الأساسي:</span>
                          <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold ${getRoleBadgeStyle(member.role)}`}>
                            {ROLE_LABELS_AR[member.role]}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60">
                          <span className="text-slate-500 font-medium">الأذونات المفعّلة:</span>
                          <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-[10px]">
                            {activePermsCount} من أصل {ALL_CLINIC_PERMISSIONS.length}
                            {hasCustomPerms && <span className="text-sky-600 mr-1">(مخصصة)</span>}
                          </span>
                        </div>
                      </div>

                      {/* Custom Permissions Customize Button for Owner */}
                      {canManageMembers && !isOwner && (
                        <button
                          onClick={() => handleOpenPermissionsModal(member)}
                          className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100/80 text-purple-700 border border-purple-200/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mb-3"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>تعديل الصلاحيات المخصصة</span>
                        </button>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    {canManageMembers && !isSelf && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {/* Change Role Selector */}
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member, e.target.value as ClinicRole)}
                          className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 focus:ring-1 focus:ring-sky-500 outline-none"
                        >
                          <option value="OWNER">OWNER (مالك)</option>
                          <option value="DOCTOR">DOCTOR (طبيب)</option>
                          <option value="SECRETARY">SECRETARY (سكرتير)</option>
                          <option value="STAFF">STAFF (كادر)</option>
                        </select>

                        <div className="flex items-center gap-1">
                          {/* Toggle Active / Disable */}
                          <button
                            onClick={() => handleToggleStatus(member)}
                            title={member.status === 'disabled' ? "تفعيل الحساب" : "تعطيل الحساب"}
                            className={`p-1.5 rounded-lg text-xs font-bold transition ${
                              member.status === 'disabled'
                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                            }`}
                          >
                            {member.status === 'disabled' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>

                          {/* Delete Member */}
                          <button
                            onClick={() => handleRemoveMember(member)}
                            title="إزالة العضو"
                            className="p-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Audit Trail Sub-Tab */
        <div className="p-6">
          {loadingAudit ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              جاري تحميل سجل الإجراءات الإدارية...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-sm">
              لا توجد إجراءات إدارية مسجلة بعد.
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-xs"
                >
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-700 shrink-0 mt-0.5">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">
                        {log.actorName || 'مالك العيادة'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString('ar-EG')}
                      </span>
                    </div>
                    <div className="text-slate-600 mt-1">
                      {log.details || log.action}
                      {log.targetName && <span className="font-bold mr-1">({log.targetName})</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customize Permissions Modal */}
      {editingPermissionsMember && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            
            <button
              onClick={() => setEditingPermissionsMember(null)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 p-1 rounded-xl bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 font-['Tajawal',sans-serif]">
                  تخصيص الصلاحيات الفردية
                </h3>
                <p className="text-xs text-slate-500">
                  تحديد الأذونات الدقيقة للموظف: <span className="font-bold text-slate-800">{editingPermissionsMember.displayName}</span> ({ROLE_LABELS_AR[editingPermissionsMember.role]})
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-purple-50 p-3 rounded-2xl border border-purple-100 text-xs text-purple-900 mb-5">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-purple-600" />
                <span>يمكنك تفعيل أو إلغاء أي صلاحية بشكل منفرد بغض النظر عن الدور الأساسي.</span>
              </div>
              <button
                type="button"
                onClick={handleResetToRoleDefaults}
                className="text-[11px] font-bold text-purple-700 underline hover:text-purple-900 shrink-0 mr-2"
              >
                استعادة الافتراضي للدور
              </button>
            </div>

            {/* Permissions Matrix by Category */}
            <div className="space-y-5 mb-6">
              {categories.map((cat) => {
                const catPerms = ALL_CLINIC_PERMISSIONS.filter((p) => p.category === cat);
                return (
                  <div key={cat} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                    <div className="text-xs font-black text-slate-800 mb-3 border-b border-slate-200 pb-1.5 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-purple-600" />
                      <span>{cat}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {catPerms.map((perm) => {
                        const isChecked = selectedPermissions.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-2.5 cursor-pointer ${
                              isChecked
                                ? 'bg-purple-50/90 border-purple-200 text-purple-900 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePermission(perm.key)}
                              className="w-4 h-4 rounded-md text-purple-600 focus:ring-purple-500 accent-purple-600"
                            />
                            <span className="flex-1">{perm.labelAr}</span>
                            <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {perm.key}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="text-xs text-slate-500 font-medium">
                تم تحديد <span className="font-bold text-purple-700">{selectedPermissions.length}</span> صلاحية
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPermissionsMember(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={isSavingPermissions}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md transition disabled:opacity-50"
                >
                  {isSavingPermissions ? 'جاري الحفظ...' : 'حفظ الصلاحيات المخصصة'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl relative animate-in fade-in duration-200">
            
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl bg-slate-100 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 font-['Tajawal',sans-serif]">
                  {createdInviteLink ? 'تم إنشاء رابط الدعوة بنجاح' : 'دعوة عضو جديد للعيادة'}
                </h3>
                <p className="text-xs text-slate-500">
                  {createdInviteLink ? 'قم بنسخ الرابط وإرساله للموظف للانضمام' : 'ربط موظف أو طبيب بنفس العيادة السحابية'}
                </p>
              </div>
            </div>

            {createdInviteLink ? (
              <div className="space-y-5">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم إنشاء الدعوة لـ {inviteName} ({ROLE_LABELS_AR[inviteRole]})</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    تم إرسال الدعوة إلى بريد <strong className="dir-ltr inline-block font-mono">{inviteEmail}</strong> ويمكن للموظف فتح هذا الرابط المباشر للقبول والدخول للعيادة:
                  </p>

                  <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-emerald-300">
                    <input
                      type="text"
                      readOnly
                      value={createdInviteLink}
                      className="w-full text-xs font-mono text-slate-700 bg-transparent outline-none dir-ltr px-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(createdInviteLink, 'modal-link')}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer"
                    >
                      {copiedToken === 'modal-link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken === 'modal-link' ? 'تم' : 'نسخ'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`دعوة للانضمام إلى عيادة كعضو (${ROLE_LABELS_AR[inviteRole]}):\n${createdInviteLink}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>مشاركة عبر الواتساب</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setCreatedInviteLink(null);
                      setInviteName('');
                      setInviteEmail('');
                      setInviteRole('SECRETARY');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                  >
                    إغلاق المودال
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الموظف / العضو بالكامل *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: د. أحمد علي أو أ. مريم السكرتيرة"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  البريد الإلكتروني للربط الحسابي *
                </label>
                <input
                  type="email"
                  required
                  placeholder="staff@clinic.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الدور والصلاحيات الافتراضية *
                </label>

                {/* Quick Selection Buttons/Pills for maximum touch/click accessibility */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setInviteRole('SECRETARY')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border transition flex flex-col items-center justify-center gap-1 ${
                      inviteRole === 'SECRETARY'
                        ? 'bg-sky-50 border-sky-500 text-sky-800 ring-1 ring-sky-500'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>سكرتير</span>
                    <span className="text-[10px] font-mono text-slate-400">SECRETARY</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteRole('DOCTOR')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border transition flex flex-col items-center justify-center gap-1 ${
                      inviteRole === 'DOCTOR'
                        ? 'bg-sky-50 border-sky-500 text-sky-800 ring-1 ring-sky-500'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>دكتور</span>
                    <span className="text-[10px] font-mono text-slate-400">DOCTOR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteRole('STAFF')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border transition flex flex-col items-center justify-center gap-1 ${
                      inviteRole === 'STAFF'
                        ? 'bg-sky-50 border-sky-500 text-sky-800 ring-1 ring-sky-500'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>موظف</span>
                    <span className="text-[10px] font-mono text-slate-400">STAFF</span>
                  </button>
                </div>

                {/* Native Dropdown Select */}
                <div className="relative">
                  <select
                    id="invite-role-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as ClinicRole)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer relative z-10"
                  >
                    <option value="SECRETARY">سكرتير (SECRETARY) - سكرتارية / استقبال</option>
                    <option value="DOCTOR">دكتور (DOCTOR) - طبيب معالج</option>
                    <option value="STAFF">موظف (STAFF) - كادر إداري ومساعد</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-20" />
                </div>

                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed bg-sky-50/80 p-2.5 rounded-xl border border-sky-100 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                  <span>{ROLE_DESCRIPTIONS_AR[inviteRole]}</span>
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingInvite ? 'جاري الإضافة...' : 'إرسال الدعوة وإضافة العضو'}
                </button>
              </div>
            </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

