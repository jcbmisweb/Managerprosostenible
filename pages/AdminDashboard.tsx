import React, { useEffect, useState } from 'react';
import { db, collection, query, where, onSnapshot, updateDoc, doc, getDocs, deleteDoc, setDoc, handleFirestoreError, OperationType, logAction } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { CoEvaluationsView } from '../components/CoEvaluationsView';
import { ProfessorDashboard } from './ProfessorDashboard';
import { StudentDashboard } from './StudentDashboard';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  LayoutDashboard, 
  FileText, 
  Search, 
  ShieldCheck,
  Clock,
  ExternalLink,
  Trash2,
  AlertCircle,
  UserCog,
  UserCheck,
  Ghost,
  ShieldAlert,
  LogOut,
  Info,
  Copy,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  UserCircle,
  Eye,
  History,
  UserMinus,
  Scale,
  BookOpen,
  Plus,
  GraduationCap,
  Calendar,
  X
} from 'lucide-react';
import { TeamMember, PeerReview, Classroom } from '../types';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'student' | 'assistant';
  status: 'pending' | 'approved' | 'suspended';
  projectId?: string;
  impersonatingUid?: string | null;
  classroomId?: string | null;
  lastLogin?: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  teamName: string;
  schoolName: string;
  createdAt: string;
  createdBy: string;
  team: TeamMember[];
  coEvaluations?: PeerReview[];
  coEvaluationPoints?: number;
  classroomId?: string | null;
}

interface AuditLog {
  id: string;
  action: string;
  details: any;
  userId: string;
  userEmail: string;
  timestamp: any;
}

export const AdminDashboard: React.FC = () => {
  const { profile, realProfile, impersonateUser, logout } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  
  // Tab states and filtering
  const [activeTab, setActiveTab] = useState<'logins' | 'classrooms' | 'users' | 'projects' | 'audit' | 'evaluations'>('logins');
  const [loginFilter, setLoginFilter] = useState<'all' | 'pending' | 'approved' | 'student' | 'professor'>('all');
  const [viewMode, setViewMode] = useState<'admin' | 'professor' | 'student'>('admin');
  const [searchTerm, setSearchTerm] = useState('');
  const [newClassroomName, setNewClassroomName] = useState('');
  const [newClassroomProfessor, setNewClassroomProfessor] = useState('');
  const [creatingClassroom, setCreatingClassroom] = useState(false);
  const [classroomsError, setClassroomsError] = useState<string | null>(null);
  const [filterClassroomId, setFilterClassroomId] = useState<string | null>(null);

  const isSuperAdmin = realProfile?.role === 'admin';
  const isAssistant = realProfile?.role === 'assistant';
  const canManageUsers = isSuperAdmin || isAssistant;

  const ROOT_ADMIN_EMAILS = ['juan.codina@murciaeduca.es', 'jcbmisweb@gmail.com'];
  const isRootAdmin = (email: string) => ROOT_ADMIN_EMAILS.includes(email.toLowerCase().trim());

  useEffect(() => {
    if (realProfile?.role !== 'admin' && realProfile?.role !== 'assistant') return;

    // Listen to all users
    const qAllUsers = query(collection(db, 'users'));
    const unsubAllUsers = onSnapshot(qAllUsers, (snapshot) => {
      setAllUsers(snapshot.docs.map(d => d.data() as UserProfile));
    }, (error) => {
      console.error("Error listening to all users:", error);
    });

    // Listen to pending users
    const qPending = query(collection(db, 'users'), where('status', '==', 'pending'));
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      setPendingUsers(snapshot.docs.map(d => d.data() as UserProfile));
    }, (error) => {
      console.error("Error listening to pending users:", error);
    });

    // Listen to all projects
    const qProjects = collection(db, 'projects');
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      setAllProjects(snapshot.docs.map(d => ({id: d.id, ...d.data()} as ProjectSummary)));
    }, (error) => {
      console.error("Error listening to projects:", error);
    });

    // Listen to audit logs
    const qAudit = query(collection(db, 'audit_logs'));
    const unsubAudit = onSnapshot(qAudit, (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
      setAuditLogs(logs.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds));
    }, (error) => {
      console.error("Error listening to audit logs:", error);
    });

    // Listen to classrooms
    const qClassrooms = isSuperAdmin 
      ? query(collection(db, 'classrooms'))
      : query(collection(db, 'classrooms'), where('professorId', '==', realProfile?.uid));
    const unsubClassrooms = onSnapshot(qClassrooms, (snapshot) => {
      setClassrooms(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Classroom)));
    }, (error) => {
      console.error("Error listening to classrooms:", error);
    });

    return () => {
      if (unsubAllUsers) unsubAllUsers();
      if (unsubPending) unsubPending();
      if (unsubProjects) unsubProjects();
      if (unsubAudit) unsubAudit();
      if (unsubClassrooms) unsubClassrooms();
    };
  }, [realProfile, isSuperAdmin]);

  const approveUser = async (uid: string) => {
    if (!canManageUsers) return;
    const targetUser = allUsers.find(u => u.uid === uid);
    if (targetUser && isRootAdmin(targetUser.email)) return;
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'approved' });
      logAction('USER_APPROVED', { uid, email: targetUser?.email });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'student' | 'assistant') => {
    if (!canManageUsers) return;
    
    // Only admins can promote to admin
    if (newRole === 'admin' && !isSuperAdmin) {
        alert("Solo los administradores pueden asignar el rol de ADMIN.");
        return;
    }

    const targetUser = allUsers.find(u => u.uid === uid);
    if (targetUser && isRootAdmin(targetUser.email)) return;
    
    try {
      const updates: any = { role: newRole };
      // Auto-approve if they were pending
      if (targetUser?.status === 'pending') {
          updates.status = 'approved';
      }
      
      await updateDoc(doc(db, 'users', uid), updates);
      logAction('ROLE_CHANGED', { uid, email: targetUser?.email, newRole, autoApproved: updates.status === 'approved' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const enterProjectAsMember = async (projectId: string, memberId: string) => {
    if (!realProfile?.uid) return;
    try {
      // Si el memberId es un UID real (largo), intentamos suplantar al usuario real
      const isRealUser = memberId.length >= 20;
      
      if (isRealUser) {
        await impersonateUser(memberId);
        logAction('ADMIN_IMPERSONATION_START', { targetUid: memberId, projectId });
      } else {
        // Si es un marcador de posición, entramos al proyecto y luego el admin 
        // tendrá que elegir esa identidad en el Dashboard
        await updateDoc(doc(db, 'users', realProfile.uid), { 
          projectId,
          impersonatingUid: null // Limpiamos suplantación previa si la había
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `users/${realProfile.uid}`);
          throw err;
        });
        logAction('ADMIN_ENTER_PROJECT', { projectId, memberId });
      }
    } catch (error) {
      console.error("Error entering project as member:", error);
    }
  };

  const rejectUser = async (uid: string) => {
    console.log('Rejecting user:', uid, 'canManageUsers:', canManageUsers);
    if (!canManageUsers) {
      alert("No tienes permisos para realizar esta acción.");
      return;
    }
    const targetUser = allUsers.find(u => u.uid === uid);
    if (targetUser && isRootAdmin(targetUser.email)) return;
    if (!window.confirm("¿Estás seguro de que quieres eliminar permanentemente a este usuario?")) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      logAction('USER_DELETED', { uid, email: targetUser?.email });
      console.log('User deleted successfully');
    } catch (error) {
      console.error("Error deleting user:", error);
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const suspendUser = async (uid: string, currentStatus: string) => {
    if (!canManageUsers) return;
    const targetUser = allUsers.find(u => u.uid === uid);
    if (targetUser && isRootAdmin(targetUser.email)) return;
    try {
      const newStatus = currentStatus === 'suspended' ? 'approved' : 'suspended';
      await updateDoc(doc(db, 'users', uid), { status: newStatus });
      logAction('USER_STATUS_CHANGE', { uid, email: targetUser?.email, newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!canManageUsers) return;
    if (!window.confirm("¿Estás seguro de que quieres eliminar este proyecto permanentemente? Todos los alumnos vinculados volverán a estar sin proyecto.")) return;
    
    try {
      // 1. Find all users in this project and reset them
      const usersInProject = allUsers.filter(u => u.projectId === projectId);
      const resetPromises = usersInProject.map(u => 
        updateDoc(doc(db, 'users', u.uid), { 
          projectId: null,
          status: 'approved' // Keep them approved but free
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
          throw err;
        })
      );
      
      await Promise.all(resetPromises);
      
      // 2. Delete the project document
      await deleteDoc(doc(db, 'projects', projectId)).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}`);
        throw err;
      });
      logAction('PROJECT_DELETED', { projectId });
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const resetUser = async (user: UserProfile) => {
    if (!canManageUsers) return;
    if (isRootAdmin(user.email)) return;
    if (!window.confirm(`¿Estás seguro de que quieres liberar a ${user.displayName} de su proyecto actual? Podrá crear o unirse a uno nuevo.`)) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { 
        projectId: null,
        status: 'approved' // Ensure they stay approved but free
      });
      logAction('USER_PROJECT_RESET', { uid: user.uid, email: user.email });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassroomName.trim() || !realProfile) return;
    setCreatingClassroom(true);
    setClassroomsError(null);
    try {
      const classroomId = doc(collection(db, 'classrooms')).id;
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const newClassroom: Classroom = {
        id: classroomId,
        name: newClassroomName.trim(),
        code,
        professorId: newClassroomProfessor || realProfile.uid,
        createdAt: new Date().toISOString()
      };
      
      const setDocPromise = setDoc(doc(db, 'classrooms', classroomId), newClassroom);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("La operación tardó demasiado. Comprueba tu conexión a internet.")), 10000)
      );
      
      await Promise.race([setDocPromise, timeoutPromise]);
      
      setNewClassroomName('');
      setNewClassroomProfessor('');
      logAction('CLASSROOM_CREATED', { id: classroomId, name: newClassroom.name, code });
    } catch (err: any) {
      console.error("Error creating classroom:", err);
      setClassroomsError(err.message || "Error al crear el aula");
    } finally {
      setCreatingClassroom(false);
    }
  };

  const handleAssignClassroom = async (uid: string, classroomId: string | null) => {
    if (!canManageUsers) return;
    try {
      const targetUser = allUsers.find(u => u.uid === uid);
      const updates: any = { classroomId: classroomId || null };
      
      // Auto-approve student if assigned to a class
      if (classroomId && targetUser?.status === 'pending') {
        updates.status = 'approved';
      }
      
      await updateDoc(doc(db, 'users', uid), updates);
      logAction('USER_CLASS_ASSIGNED', { uid, email: targetUser?.email, classroomId });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDeleteClassroom = async (classroomId: string) => {
    if (!canManageUsers) return;
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta aula? Los alumnos y proyectos asociados quedarán huérfanos.")) return;
    try {
      // 1. Reset all users in this classroom
      const usersInClassroom = allUsers.filter(u => u.classroomId === classroomId);
      const userPromises = usersInClassroom.map(u => 
        updateDoc(doc(db, 'users', u.uid), { classroomId: null })
      );
      await Promise.all(userPromises);
      
      // 2. Reset all projects in this classroom
      const projectsInClassroom = allProjects.filter(p => p.classroomId === classroomId);
      const projectPromises = projectsInClassroom.map(p => 
        updateDoc(doc(db, 'projects', p.id), { classroomId: null })
      );
      await Promise.all(projectPromises);
      
      // 3. Delete classroom doc
      await deleteDoc(doc(db, 'classrooms', classroomId));
      logAction('CLASSROOM_DELETED', { classroomId });
      
      if (filterClassroomId === classroomId) {
        setFilterClassroomId(null);
      }
    } catch (error) {
      console.error("Error deleting classroom:", error);
    }
  };

  const myClassroomIds = classrooms.map(c => c.id);

  const filteredUsers = allUsers.filter(u => {
    const displayName = u.displayName || '';
    const email = u.email || '';
    const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          email.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    
    // Global filter from sidebar/header
    if (filterClassroomId && u.classroomId !== filterClassroomId) return false;
    
    if (isSuperAdmin) return true;
    
    // Teacher filtering
    const isInMyClassroom = u.classroomId && myClassroomIds.includes(u.classroomId);
    const isPendingStudent = u.status === 'pending' && u.role === 'student';
    return isInMyClassroom || isPendingStudent || u.uid === realProfile?.uid;
  }).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

  // Detect duplicate accounts (same email, different UID)
  const duplicateEmails = allUsers.reduce((acc: {[email: string]: number}, user) => {
    const email = (user.email || '').toLowerCase().trim();
    acc[email] = (acc[email] || 0) + 1;
    return acc;
  }, {});

  const filteredLogins = allUsers.filter(u => {
    const displayName = u.displayName || '';
    const email = u.email || '';
    const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          email.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    
    // Global filter from sidebar/header: do NOT filter out pending users or users without a classroom
    // so that new logins are ALWAYS visible in this registry tab even if a classroom is selected.
    if (filterClassroomId && u.classroomId !== filterClassroomId && u.status !== 'pending' && u.classroomId != null) {
      return false;
    }
    
    // Login tab specific filters
    if (loginFilter === 'pending') return u.status === 'pending';
    if (loginFilter === 'approved') return u.status === 'approved';
    if (loginFilter === 'student') return u.role === 'student';
    if (loginFilter === 'professor') return u.role === 'assistant';
    
    return true;
  }).sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    if (a.lastLogin && b.lastLogin) return b.lastLogin.localeCompare(a.lastLogin);
    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  const filteredProjects = allProjects.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.teamName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.code || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    
    // Global filter from sidebar/header
    if (filterClassroomId && p.classroomId !== filterClassroomId) return false;
    
    if (isSuperAdmin) return true;
    
    // Teacher filtering
    return p.classroomId && myClassroomIds.includes(p.classroomId);
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight text-white">Panel Admin</h1>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Seleccionar Vista</p>
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => setViewMode('admin')} className={`px-3 py-1 text-xs rounded ${viewMode === 'admin' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Admin</button>
            <button onClick={() => setViewMode('professor')} className={`px-3 py-1 text-xs rounded ${viewMode === 'professor' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Profesor</button>
            <button onClick={() => setViewMode('student')} className={`px-3 py-1 text-xs rounded ${viewMode === 'student' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Alumno</button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('logins')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'logins' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="font-medium font-bold text-sm">Registro de Logins</span>
            {pendingUsers.length > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('classrooms')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'classrooms' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="font-medium">Gestión de Aulas</span>
            {classrooms.length > 0 && (
              <span className="ml-auto bg-slate-800 text-slate-200 text-xs font-bold px-2 py-0.5 rounded-full">
                {classrooms.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'users' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Alumnos y Personal</span>
            {pendingUsers.length > 0 && (
              <span className="ml-auto bg-white text-emerald-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'projects' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Proyectos Globales</span>
          </button>
          <button
            onClick={() => setActiveTab('evaluations')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'evaluations' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Scale className="w-5 h-5" />
            <span className="font-medium">Coevaluaciones</span>
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'audit' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <FileText className="w-5 h-5" />
              <span className="font-medium">Auditoría</span>
            </button>
          )}
        </nav>

        <div className="p-6 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <img src={profile?.photoURL} alt="" className="w-10 h-10 rounded-full border-2 border-emerald-400" />
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{profile?.displayName}</p>
              <p className="text-xs text-slate-400 truncate">Administrador</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-400 py-2 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {viewMode === 'professor' ? (
          <ProfessorDashboard />
        ) : viewMode === 'student' ? (
          <StudentDashboard />
        ) : (
          <>
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {activeTab === 'logins'
                  ? 'Registro y Control de Accesos'
                  : activeTab === 'classrooms' 
                    ? 'Gestión de Aulas' 
                    : activeTab === 'users' 
                      ? 'Alumnos y Personal' 
                      : activeTab === 'projects' 
                        ? 'Explorador de Proyectos' 
                        : activeTab === 'evaluations'
                          ? 'Coevaluaciones'
                          : 'Registro de Auditoría'}
              </h2>
              {filterClassroomId && (
                <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-200">
                  Aula: {classrooms.find(c => c.id === filterClassroomId)?.name}
                  <button onClick={() => setFilterClassroomId(null)} className="hover:text-red-500 font-black ml-1 text-sm">×</button>
                </span>
              )}
            </div>
            <p className="text-slate-500 font-medium text-sm mt-1">
              {activeTab === 'logins'
                ? 'Monitorea todas las cuentas que han ingresado a la web. Concédeles acceso, asígnalas a un aula o suspéndelas en tiempo real.'
                : activeTab === 'classrooms'
                  ? 'Crea aulas para organizar a tus alumnos e invítalos usando el código generado.'
                  : activeTab === 'users'
                    ? 'Gestiona el acceso, aulas, roles y estados de tus estudiantes.'
                    : activeTab === 'projects'
                      ? 'Visualiza y supervisa los proyectos de los equipos.'
                      : activeTab === 'evaluations'
                        ? 'Resultados y observaciones de las coevaluaciones de los alumnos.'
                        : 'Historial de acciones críticas del sistema.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin);
                const btn = document.activeElement as HTMLButtonElement;
                const originalText = btn.innerHTML;
                btn.innerHTML = '¡Copiado!';
                setTimeout(() => { btn.innerHTML = originalText; }, 2000);
              }}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
            >
              <Copy className="w-4 h-4" />
              Copiar Enlace de Registro
            </button>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-medium"
              />
            </div>
          </div>
        </header>

        {activeTab === 'logins' && (
          <>
            {/* Bento-grid Stats for Logins */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl text-slate-600">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inicios de Sesión</p>
                  <p className="text-3xl font-black text-slate-900">{allUsers.length}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Cuentas registradas</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="bg-amber-50 p-4 rounded-2xl text-amber-600">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pendientes de Acceso</p>
                  <p className="text-3xl font-black text-amber-700">{pendingUsers.length}</p>
                  <p className="text-xs text-amber-500 font-medium mt-1">Esperando aprobación</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600">
                  <UserCheck size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Accesos Permitidos</p>
                  <p className="text-3xl font-black text-emerald-700">{allUsers.filter(u => u.status === 'approved').length}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Cuentas habilitadas</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="bg-red-50 p-4 rounded-2xl text-red-500">
                  <PauseCircle size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accesos Suspendidos</p>
                  <p className="text-3xl font-black text-red-600">{allUsers.filter(u => u.status === 'suspended').length}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Cuentas pausadas</p>
                </div>
              </div>
            </div>

            {/* Informative Help Card */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 mb-8 flex items-start gap-4 shadow-sm">
              <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-emerald-900 uppercase tracking-wide">¿Cómo funciona el Control de Acceso Automático?</h4>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Cualquier persona que inicie sesión con su cuenta de Google en la web queda registrada aquí en tiempo real de forma segura. 
                  Por defecto, su acceso está <strong>"Pendiente"</strong>. Al pulsar <strong>"Habilitar Alumno"</strong> o asignarle un <strong>Aula</strong>, 
                  se le concederá acceso inmediato y se le redireccionará automáticamente a su espacio académico.
                </p>
              </div>
            </div>

            {/* Filters Row */}
            <div className="bg-white rounded-3xl border border-slate-100 p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'approved', 'student', 'professor'] as const).map((filter) => {
                  const isActive = loginFilter === filter;
                  const label = filter === 'all' ? 'Todos' :
                                filter === 'pending' ? `Pendientes (${pendingUsers.length})` :
                                filter === 'approved' ? 'Aprobados' :
                                filter === 'student' ? 'Alumnos' : 'Profesores';
                  
                  return (
                    <button
                      key={filter}
                      onClick={() => setLoginFilter(filter)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isActive 
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Mostrando {filteredLogins.length} de {allUsers.length} cuentas registradas
              </p>
            </div>

            {/* Main Logins Table */}
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="p-5 pl-8">Cuenta / Email</th>
                      <th className="p-5">Estado</th>
                      <th className="p-5">Rol Asignado</th>
                      <th className="p-5">Redirección a Aula</th>
                      <th className="p-5">Última Conexión</th>
                      <th className="p-5 pr-8 text-right">Acciones Rápidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredLogins.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-24 text-center">
                          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500 font-bold text-lg">No se encontraron cuentas</p>
                          <p className="text-slate-400 text-sm font-medium mt-1">Prueba a buscar otro término o cambia los filtros de acceso.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredLogins.map((user) => {
                        const isRoot = isRootAdmin(user.email);
                        const isUserSuspended = user.status === 'suspended';
                        const isUserPending = user.status === 'pending';
                        
                        return (
                          <tr key={user.uid} className="hover:bg-slate-50/30 transition-colors">
                            <td className="p-5 pl-8">
                              <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                  <img 
                                    src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} 
                                    alt="" 
                                    className="w-11 h-11 rounded-full border border-slate-200 bg-white" 
                                  />
                                  {isUserPending ? (
                                    <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 border-2 border-white animate-pulse">
                                      <Clock className="w-3 h-3" />
                                    </div>
                                  ) : isUserSuspended ? (
                                    <div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-0.5 border-2 border-white">
                                      <PauseCircle className="w-3 h-3" />
                                    </div>
                                  ) : (
                                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white">
                                      <CheckCircle className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                    <span className="truncate">{user.displayName || 'Sin Nombre'}</span>
                                    {duplicateEmails[user.email.toLowerCase().trim()] > 1 && (
                                      <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider shrink-0" title="Cuenta Duplicada">DUPLICADA</span>
                                    )}
                                    {isRoot && (
                                      <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider shrink-0">SÚPER ADMIN</span>
                                    )}
                                  </h4>
                                  <p className="text-xs text-slate-400 font-mono tracking-tight truncate mt-0.5">{user.email}</p>
                                </div>
                              </div>
                            </td>

                            <td className="p-5">
                              {isUserPending ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-lg border border-amber-100 uppercase tracking-wider animate-pulse">
                                  <Clock className="w-3 h-3" />
                                  Pendiente
                                </span>
                              ) : isUserSuspended ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black rounded-lg border border-red-100 uppercase tracking-wider">
                                  <PauseCircle className="w-3 h-3" />
                                  Suspendido
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg border border-emerald-100 uppercase tracking-wider">
                                  <CheckCircle className="w-3 h-3" />
                                  Permitido
                                </span>
                              )}
                            </td>

                            <td className="p-5">
                              {isRoot ? (
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 uppercase tracking-wide">
                                  Súper Administrador
                                </span>
                              ) : (
                                <select
                                  disabled={!canManageUsers || isRoot}
                                  value={user.role}
                                  onChange={(e) => handleRoleChange(user.uid, e.target.value as any)}
                                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                >
                                  <option value="student">Alumno</option>
                                  <option value="assistant">Profesor / Asistente</option>
                                  <option value="admin">Administrador</option>
                                </select>
                              )}
                            </td>

                            <td className="p-5">
                              {user.role === 'admin' ? (
                                <span className="text-xs text-slate-400 italic">No aplicable (Admin)</span>
                              ) : (
                                <select
                                  disabled={!canManageUsers || isRoot}
                                  value={user.classroomId || ''}
                                  onChange={(e) => handleAssignClassroom(user.uid, e.target.value ? e.target.value : null)}
                                  className="w-full max-w-[200px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                >
                                  <option value="">-- Sin Aula (Waiting Room) --</option>
                                  {classrooms.map((cls) => (
                                    <option key={cls.id} value={cls.id}>
                                      {cls.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>

                            <td className="p-5 whitespace-nowrap">
                              {user.lastLogin ? (
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-700">
                                    {new Date(user.lastLogin).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium font-mono mt-0.5">
                                    {new Date(user.lastLogin).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 font-mono">Nunca</span>
                              )}
                            </td>

                            <td className="p-5 pr-8 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isUserPending && !isRoot ? (
                                  <>
                                    <button
                                      onClick={async () => {
                                        // Quick approve as student
                                        await updateDoc(doc(db, 'users', user.uid), { 
                                          status: 'approved',
                                          role: 'student'
                                        });
                                        logAction('USER_APPROVED', { uid: user.uid, email: user.email });
                                      }}
                                      title="Dar acceso como Alumno"
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                                    >
                                      <UserCheck size={14} />
                                      Habilitar Alumno
                                    </button>
                                    <button
                                      onClick={async () => {
                                        // Quick approve as teacher
                                        await updateDoc(doc(db, 'users', user.uid), { 
                                          status: 'approved',
                                          role: 'assistant'
                                        });
                                        logAction('USER_APPROVED', { uid: user.uid, email: user.email });
                                      }}
                                      title="Dar acceso como Profesor"
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                                    >
                                      <ShieldCheck size={14} />
                                      Profesor
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {!isRoot && (
                                      <button
                                        onClick={() => impersonateUser(user.uid)}
                                        title="Suplantar"
                                        className="bg-blue-50 text-blue-600 p-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                                      >
                                        <Ghost size={16} />
                                      </button>
                                    )}
                                    {canManageUsers && !isRoot && user.uid !== realProfile?.uid && (
                                      <>
                                        <button
                                          onClick={() => suspendUser(user.uid, user.status)}
                                          title={isUserSuspended ? "Activar cuenta" : "Suspender cuenta"}
                                          className={`p-2.5 rounded-xl transition-all ${
                                            isUserSuspended 
                                              ? 'bg-amber-100 text-amber-700 hover:bg-emerald-100 hover:text-emerald-700' 
                                              : 'bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-700'
                                          }`}
                                        >
                                          {isUserSuspended ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                                        </button>
                                        <button
                                          onClick={() => rejectUser(user.uid)}
                                          title="Eliminar permanentemente"
                                          className="bg-slate-100 text-slate-400 p-2.5 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'classrooms' && (
          <div className="space-y-8">
            {/* Bento-grid form for creation */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
              <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mb-2">
                <BookOpen className="text-emerald-500" />
                Crear una Nueva Aula de Clase
              </h3>
              <p className="text-slate-500 text-sm mb-6">Elige un nombre descriptivo (ej: 4º de la ESO - Tecnología) para agrupar a los estudiantes y sus proyectos.</p>
              
              <form onSubmit={handleCreateClassroom} className="flex flex-col gap-3">
                {classroomsError && (
                  <p className="text-red-500 text-xs font-bold bg-red-50 border border-red-100 p-3 rounded-xl mb-2">
                    {classroomsError}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Nombre de la nueva clase o aula..."
                    value={newClassroomName}
                    onChange={(e) => setNewClassroomName(e.target.value)}
                    className="flex-[2] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-sm"
                  />
                  <select
                    value={newClassroomProfessor}
                    onChange={(e) => setNewClassroomProfessor(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-sm text-slate-700"
                  >
                    <option value="">-- Sin asignar (Tú) --</option>
                    {allUsers.filter(u => u.role === 'assistant' || u.role === 'admin').map(u => (
                      <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={creatingClassroom || !newClassroomName.trim()}
                    className="bg-slate-900 text-white hover:bg-slate-800 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Plus size={16} />
                    Crear Aula
                  </button>
                </div>
              </form>
            </div>

            {/* Classrooms list */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classrooms.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                  <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h4 className="text-lg font-bold text-slate-900 mb-1">No tienes aulas creadas todavía</h4>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto">
                    Crea tu primera aula de clase usando el formulario de arriba para poder organizar a tus alumnos.
                  </p>
                </div>
              ) : (
                classrooms.map((classroom) => {
                  const classStudents = allUsers.filter(u => u.classroomId === classroom.id);
                  const classProjects = allProjects.filter(p => p.classroomId === classroom.id);
                  
                  return (
                    <div key={classroom.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 hover:shadow-md transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <GraduationCap className="w-6 h-6 text-slate-700" />
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Código del Aula</span>
                            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                              <code className="text-xs font-mono font-black text-slate-800 tracking-wide">{classroom.code}</code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(classroom.code);
                                  alert(`Código "${classroom.code}" copiado al portapapeles.`);
                                }}
                                className="text-slate-400 hover:text-slate-700 transition-colors"
                                title="Copiar código"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <h4 className="text-lg font-black text-slate-900 tracking-tight mb-2 truncate" title={classroom.name}>
                          {classroom.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold mb-4">
                          Creada el {new Date(classroom.createdAt).toLocaleDateString()}
                        </p>

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                          <button
                            onClick={() => {
                              setFilterClassroomId(classroom.id);
                              setActiveTab('users');
                            }}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl p-3 text-left transition-all"
                          >
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Alumnos</span>
                            <span className="text-xl font-black text-slate-900">{classStudents.length}</span>
                          </button>
                          <button
                            onClick={() => {
                              setFilterClassroomId(classroom.id);
                              setActiveTab('projects');
                            }}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl p-3 text-left transition-all"
                          >
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Proyectos</span>
                            <span className="text-xl font-black text-slate-900">{classProjects.length}</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-50 gap-2">
                        <button
                          onClick={() => {
                            if (filterClassroomId === classroom.id) {
                              setFilterClassroomId(null);
                            } else {
                              setFilterClassroomId(classroom.id);
                            }
                          }}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                            filterClassroomId === classroom.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {filterClassroomId === classroom.id ? 'Filtrando...' : 'Filtrar Panel'}
                        </button>
                        
                        <button
                          onClick={() => handleDeleteClassroom(classroom.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar aula"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <>
            {filterClassroomId && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-900">
                  Mostrando alumnos de: <span className="font-black">{classrooms.find(c => c.id === filterClassroomId)?.name}</span>
                </h3>
                <button 
                  onClick={() => setFilterClassroomId(null)}
                  className="text-emerald-700 text-xs font-bold hover:underline"
                >
                  Ver todos los usuarios
                </button>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-xl">
                <Info className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-900">¿Cómo dar de alta a alumnos y profesores?</h4>
                <p className="text-xs text-blue-700 leading-relaxed mt-1">
                  Los usuarios deben iniciar sesión primero con su cuenta de Google. Una vez que lo hagan, aparecerán aquí como <strong>"Pendientes"</strong>. 
                  Usa el botón verde para aprobar su acceso y selecciona su rol (Alumno, Asistente o Admin).
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="p-4 pl-6">Usuario</th>
                      <th className="p-4">Rol</th>
                      <th className="p-4">Aula y Proyecto</th>
                      <th className="p-4">Última Conexión</th>
                      <th className="p-4 pr-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No se encontraron usuarios.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const userProject = allProjects.find(p => p.team.some(m => m.id === user.uid));
                      return (
                        <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <img src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="" className="w-10 h-10 rounded-full border border-slate-200 bg-white" />
                                {user.status === 'approved' ? (
                                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white">
                                    <CheckCircle className="w-3 h-3" />
                                  </div>
                                ) : user.status === 'suspended' ? (
                                  <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 border-2 border-white">
                                    <PauseCircle className="w-3 h-3" />
                                  </div>
                                ) : (
                                  <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 border-2 border-white">
                                    <Clock className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                                  <span className="truncate">{user.displayName}</span>
                                  {duplicateEmails[user.email.toLowerCase().trim()] > 1 && (
                                    <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0" title="Cuenta Duplicada">DUPLICADA</span>
                                  )}
                                  {user.status === 'pending' && (
                                    <span className="text-[9px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">PENDIENTE</span>
                                  )}
                                </h3>
                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          
                          <td className="p-4 align-top">
                            <div className="flex bg-slate-100 rounded-lg p-1 w-max">
                              {(['student', 'assistant', 'admin'] as const).map((role) => {
                                const isRootUser = isRootAdmin(user.email);
                                return (
                                  <button
                                    key={role}
                                    disabled={!canManageUsers || user.uid === realProfile?.uid || isRootUser}
                                    onClick={() => handleRoleChange(user.uid, role)}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                                      user.role === role 
                                        ? 'bg-white text-slate-900 shadow-sm' 
                                        : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                  >
                                    {role === 'admin' ? 'ADMIN' : role === 'assistant' ? 'PROFESOR' : 'ALUMNO'}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          
                          <td className="p-4 align-top">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <select
                                  disabled={!canManageUsers || isRootAdmin(user.email)}
                                  value={user.classroomId || ''}
                                  onChange={(e) => handleAssignClassroom(user.uid, e.target.value || null)}
                                  className="bg-transparent text-xs font-bold text-slate-700 outline-none hover:bg-slate-100 px-1 py-0.5 rounded cursor-pointer disabled:opacity-50 max-w-[150px] truncate"
                                >
                                  <option value="">-- Sin Aula --</option>
                                  {classrooms.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                                {filterClassroomId && user.classroomId === filterClassroomId && (
                                  <button onClick={() => handleAssignClassroom(user.uid, null)} className="text-red-400 hover:text-red-600 ml-auto shrink-0" title="Desvincular del aula">
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                              {userProject && (
                                <div className="flex items-center gap-2">
                                  <LayoutDashboard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{userProject.name}</span>
                                  <button
                                    onClick={() => setActiveTab('projects')}
                                    className="text-[9px] bg-slate-100 text-slate-600 hover:bg-slate-200 px-1.5 py-0.5 rounded font-bold uppercase ml-auto shrink-0"
                                  >
                                    Ver
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          
                          <td className="p-4 align-top">
                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Desconocido'}
                            </span>
                          </td>
                          
                          <td className="p-4 pr-6 align-top">
                            <div className="flex justify-end gap-1.5">
                              {user.status === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => approveUser(user.uid)}
                                    disabled={!canManageUsers}
                                    title="Activar Cuenta"
                                    className="bg-emerald-100 text-emerald-700 p-2 rounded-xl hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50"
                                  >
                                    <CheckCircle size={16} />
                                  </button>
                                  <button
                                    onClick={() => rejectUser(user.uid)}
                                    disabled={!canManageUsers}
                                    title="Rechazar"
                                    className="bg-red-50 text-red-600 p-2 rounded-xl hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {!isRootAdmin(user.email) && (
                                    <button
                                      onClick={() => impersonateUser(user.uid)}
                                      title="Suplantar"
                                      className="bg-blue-50 text-blue-600 p-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                                    >
                                      <Ghost size={16} />
                                    </button>
                                  )}
                                  {canManageUsers && user.uid !== realProfile?.uid && !isRootAdmin(user.email) && (
                                    <>
                                      <button
                                        onClick={() => suspendUser(user.uid, user.status)}
                                        title={user.status === 'suspended' ? "Activar cuenta" : "Suspender cuenta"}
                                        className={`p-2 rounded-xl transition-all ${
                                          user.status === 'suspended' 
                                            ? 'bg-amber-100 text-amber-700 hover:bg-emerald-100 hover:text-emerald-700' 
                                            : 'bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-700'
                                        }`}
                                      >
                                        {user.status === 'suspended' ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                                      </button>
                                      <button
                                        onClick={() => resetUser(user)}
                                        title="Liberar de su proyecto"
                                        className="bg-slate-100 text-slate-500 p-2 rounded-xl hover:bg-blue-100 hover:text-blue-700 transition-all"
                                      >
                                        <UserMinus size={16} />
                                      </button>
                                      <button
                                        onClick={() => rejectUser(user.uid)}
                                        title="Eliminar permanentemente"
                                        className="bg-slate-100 text-slate-500 p-2 rounded-xl hover:bg-red-100 hover:text-red-700 transition-all"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'projects' && (
          <>
            {filterClassroomId && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-900">
                  Mostrando proyectos de: <span className="font-black">{classrooms.find(c => c.id === filterClassroomId)?.name}</span>
                </h3>
                <button 
                  onClick={() => setFilterClassroomId(null)}
                  className="text-emerald-700 text-xs font-bold hover:underline"
                >
                  Ver todos los proyectos
                </button>
              </div>
            )}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {filteredProjects.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <LayoutDashboard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">No se encontraron proyectos.</p>
              </div>
            ) : (
              filteredProjects.map((project) => (
                <div key={project.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all flex flex-col">
                  <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{project.name}</h3>
                        <p className="text-sm text-slate-500 font-medium">{project.schoolName || 'Sin centro educativo'}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <code className="text-xs font-mono font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg mb-2">
                          {project.code}
                        </code>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código de Equipo</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-black uppercase tracking-wide">
                        {project.teamName || 'Equipo sin nombre'}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                        <Clock size={14} />
                        Creado el {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="p-8 flex-1">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Users size={14} /> Miembros del Equipo ({project.team.length}/5)
                    </h4>
                    
                    <div className="grid gap-3">
                      {project.team.map((member) => {
                        const isReal = member.id.length >= 20;
                        return (
                          <button
                            key={member.id}
                            onClick={() => enterProjectAsMember(project.id, member.id)}
                            className="group flex items-center justify-between p-4 rounded-2xl border-2 border-slate-50 hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isReal ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                {member.name.charAt(0)}
                              </div>
                              <div className="text-left">
                                <p className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{member.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                  {isReal ? 'Usuario Vinculado' : 'Nombre Reservado'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-600 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                              <span className="text-[10px] font-black uppercase">Ver como él</span>
                              <Eye size={16} />
                            </div>
                          </button>
                        );
                      })}
                      {project.team.length === 0 && (
                        <p className="text-sm text-slate-400 italic text-center py-4">No hay miembros registrados aún.</p>
                      )}
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      ID: {project.id.substring(0, 8)}...
                    </div>
                    <button 
                      onClick={() => enterProjectAsMember(project.id, 'admin')}
                      className="flex items-center gap-2 px-4 py-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-all text-xs font-black uppercase tracking-widest"
                    >
                      <LayoutDashboard size={14} />
                      Entrar
                    </button>
                    <button 
                      onClick={() => deleteProject(project.id)}
                      className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all text-xs font-black uppercase tracking-widest"
                    >
                      <Trash2 size={14} />
                      Eliminar Proyecto
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>)}

        {activeTab === 'evaluations' && (
          <CoEvaluationsView projects={filteredProjects} users={allUsers} />
        )}

        {activeTab === 'audit' && (
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Registro de Auditoría</h3>
                <p className="text-sm text-slate-500 font-medium">Historial de acciones críticas realizadas en el sistema.</p>
              </div>
              <History className="text-slate-300 w-8 h-8" />
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha y Hora</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-slate-400 italic font-medium">
                        No hay registros de auditoría disponibles.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-8 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">
                              {log.timestamp?.toDate().toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {log.timestamp?.toDate().toLocaleTimeString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                            log.action.includes('DELETE') || log.action.includes('REJECT') 
                              ? 'bg-red-50 text-red-600' 
                              : log.action.includes('APPROVE') 
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-blue-50 text-blue-600'
                          }`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">{log.userEmail}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: {log.userId.substring(0, 8)}...</span>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <div className="max-w-xs overflow-hidden text-ellipsis">
                            <pre className="text-[10px] font-mono text-slate-500 bg-slate-50 p-2 rounded-lg">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    )}
  </main>
</div>
  );
};
