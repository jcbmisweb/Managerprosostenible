import React, { useEffect, useState } from 'react';
import { 
  db, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  deleteDoc, 
  setDoc, 
  handleFirestoreError, 
  OperationType, 
  logAction 
} from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Classroom, TeamMember, PeerReview } from '../types';
import { CoEvaluationsView } from '../components/CoEvaluationsView';
import { 
  Users, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  GraduationCap, 
  Copy, 
  Search, 
  AlertCircle, 
  Eye, 
  BookOpen, 
  Scale, 
  PauseCircle, 
  PlayCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  UserMinus,
  Info,
  LogOut
} from 'lucide-react';

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

export const ProfessorDashboard: React.FC = () => {
  const { profile, realProfile, logout } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroomsError, setClassroomsError] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([]);
  
  // Tab states and filtering
  const [activeTab, setActiveTab] = useState<'classrooms' | 'users' | 'projects' | 'evaluations'>('classrooms');
  const [searchTerm, setSearchTerm] = useState('');
  const [newClassroomName, setNewClassroomName] = useState('');
  const [creatingClassroom, setCreatingClassroom] = useState(false);
  const [filterClassroomId, setFilterClassroomId] = useState<string | null>(null);

  const isSuperAdmin = realProfile?.role === 'admin';
  const myUid = realProfile?.uid || profile?.uid;

  // Listen to classrooms owned by this professor
  useEffect(() => {
    if (!myUid) return;

    const qClassrooms = query(collection(db, 'classrooms'), where('professorId', '==', myUid));
    const unsubscribe = onSnapshot(qClassrooms, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom));
      setClassrooms(data);
      setClassroomsError(null);
    }, (error) => {
      console.error("Error fetching classrooms:", error);
      setClassroomsError("Error al cargar tus aulas");
    });

    return () => unsubscribe();
  }, [myUid]);

  // Listen to all users
  useEffect(() => {
    if (!myUid) return;

    const qUsers = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as UserProfile);
      setAllUsers(data);
    }, (error) => {
      console.error("Error fetching users:", error);
    });

    return () => unsubscribe();
  }, [myUid]);

  // Listen to all projects
  useEffect(() => {
    if (!myUid) return;

    const qProjects = query(collection(db, 'projects'));
    const unsubscribe = onSnapshot(qProjects, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectSummary));
      setAllProjects(data);
    }, (error) => {
      console.error("Error fetching projects:", error);
    });

    return () => unsubscribe();
  }, [myUid]);

  // Classroom creation handler
  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassroomName.trim() || !myUid) return;
    setCreatingClassroom(true);
    setClassroomsError(null);
    try {
      const classroomId = doc(collection(db, 'classrooms')).id;
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const newClassroom: Classroom = {
        id: classroomId,
        name: newClassroomName.trim(),
        code,
        professorId: myUid,
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'classrooms', classroomId), newClassroom);
      setNewClassroomName('');
      logAction('CLASSROOM_CREATED', { id: classroomId, name: newClassroom.name, code });
    } catch (err: any) {
      setClassroomsError(err.message || "Error al crear el aula");
    } finally {
      setCreatingClassroom(false);
    }
  };

  // Classroom deletion (Restricted to Admins, or showing disabled state for Assistant)
  const handleDeleteClassroom = async (classroomId: string) => {
    if (!isSuperAdmin) {
      alert("Solo un Administrador global puede eliminar aulas permanentemente.");
      return;
    }
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
      logAction('CLASSROOM_DELETED_BY_PROFESSOR', { classroomId });
      
      if (filterClassroomId === classroomId) {
        setFilterClassroomId(null);
      }
    } catch (error) {
      console.error("Error deleting classroom:", error);
    }
  };

  // User management handlers
  const approveUser = async (uid: string) => {
    const targetUser = allUsers.find(u => u.uid === uid);
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'approved' });
      logAction('USER_APPROVED', { uid, email: targetUser?.email });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleAssignClassroom = async (uid: string, classroomId: string | null) => {
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

  const suspendUser = async (uid: string, currentStatus: string) => {
    const targetUser = allUsers.find(u => u.uid === uid);
    try {
      const newStatus = currentStatus === 'suspended' ? 'approved' : 'suspended';
      await updateDoc(doc(db, 'users', uid), { status: newStatus });
      logAction('USER_STATUS_CHANGE', { uid, email: targetUser?.email, newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const resetUser = async (user: UserProfile) => {
    if (!window.confirm(`¿Estás seguro de que quieres liberar a ${user.displayName} de su proyecto actual? Podrá crear o unirse a uno nuevo.`)) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { 
        projectId: null,
        status: 'approved' 
      });
      logAction('USER_PROJECT_RESET', { uid: user.uid, email: user.email });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Enter a student's project view
  const enterProjectAsMember = async (projectId: string, memberId: string) => {
    if (!myUid) return;
    try {
      await updateDoc(doc(db, 'users', myUid), { 
        projectId,
        impersonatingUid: null
      });
      logAction('PROFESSOR_ENTER_PROJECT', { projectId, memberId });
    } catch (error) {
      console.error("Error entering project as member:", error);
    }
  };

  // Project deletion (Restricted to Admins)
  const deleteProject = async (projectId: string) => {
    if (!isSuperAdmin) {
      alert("Solo un Administrador global puede eliminar proyectos permanentemente.");
      return;
    }
    if (!window.confirm("¿Estás seguro de que quieres eliminar este proyecto permanentemente? Todos los alumnos vinculados volverán a estar sin proyecto.")) return;
    
    try {
      const usersInProject = allUsers.filter(u => u.projectId === projectId);
      const resetPromises = usersInProject.map(u => 
        updateDoc(doc(db, 'users', u.uid), { 
          projectId: null,
          status: 'approved'
        })
      );
      
      await Promise.all(resetPromises);
      await deleteDoc(doc(db, 'projects', projectId));
      logAction('PROJECT_DELETED_BY_PROFESSOR', { projectId });
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  // Filters
  const myClassroomIds = classrooms.map(c => c.id);

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    
    // Global filter from classroom selection
    if (filterClassroomId && u.classroomId !== filterClassroomId) return false;
    
    // Filter to show:
    // 1. Students in this professor's classrooms.
    // 2. Pending student registrations (so professor can approve and assign them).
    // 3. The professor's own account.
    const isInMyClassroom = u.classroomId && myClassroomIds.includes(u.classroomId);
    const isPendingStudent = u.status === 'pending' && u.role === 'student';
    return isInMyClassroom || isPendingStudent || u.uid === myUid;
  });

  const filteredProjects = allProjects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.teamName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.code.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    
    // Global filter from classroom selection
    if (filterClassroomId && p.classroomId !== filterClassroomId) return false;
    
    // Show only projects belonging to this professor's classrooms
    return p.classroomId && myClassroomIds.includes(p.classroomId);
  });

  // Calculate totals
  const totalStudentsCount = allUsers.filter(u => u.role === 'student' && u.classroomId && myClassroomIds.includes(u.classroomId)).length;
  const pendingStudentsCount = allUsers.filter(u => u.status === 'pending' && u.role === 'student').length;

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      
      {/* Top Welcome Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2.5 rounded-2xl">
              <GraduationCap className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Panel del Profesor</h1>
              <p className="text-slate-500 font-medium text-sm mt-0.5">
                Organiza tus clases, supervisa el progreso de tus alumnos y evalúa sus proyectos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin);
              alert("Enlace de registro copiado al portapapeles.");
            }}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10"
          >
            <Copy className="w-4 h-4" />
            Copiar Enlace de Registro
          </button>
          
          <button 
            onClick={logout}
            className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 px-5 py-3 rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Statistics Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">Aulas de Clase</span>
            <span className="text-3xl font-black text-slate-900">{classrooms.length}</span>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl text-slate-700 border border-slate-100">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">Alumnos Activos</span>
            <span className="text-3xl font-black text-slate-900">{totalStudentsCount}</span>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl text-slate-700 border border-slate-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">Proyectos Creados</span>
            <span className="text-3xl font-black text-slate-900">{filteredProjects.length}</span>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl text-slate-700 border border-slate-100">
            <LayoutDashboard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">Pendientes de Alta</span>
            <span className="text-3xl font-black text-emerald-600">{pendingStudentsCount}</span>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 border border-emerald-100">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Tabs navigation and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <nav className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit">
          <button 
            onClick={() => setActiveTab('classrooms')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'classrooms' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Aulas
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Alumnos
            {pendingStudentsCount > 0 && (
              <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-bounce">
                {pendingStudentsCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('projects')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'projects' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Proyectos
          </button>
          <button 
            onClick={() => setActiveTab('evaluations')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'evaluations' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Coevaluaciones
          </button>
        </nav>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-3">
          {filterClassroomId && (
            <span className="bg-emerald-100 text-emerald-800 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-200">
              Aula: {classrooms.find(c => c.id === filterClassroomId)?.name}
              <button onClick={() => setFilterClassroomId(null)} className="hover:text-red-500 font-black ml-1 text-sm">×</button>
            </span>
          )}

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-medium"
            />
          </div>
        </div>
      </div>

      {/* MAIN VIEW CONTENT ACCORDING TO TABS */}

      {/* Classroom Tab */}
      {activeTab === 'classrooms' && (
        <div className="space-y-8">
          {/* Create classroom Form */}
          <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mb-2">
              <BookOpen className="text-emerald-500" />
              Crear una Nueva Aula de Clase
            </h3>
            <p className="text-slate-500 text-sm mb-6">Elige un nombre descriptivo para agrupar a tus estudiantes y organizar sus proyectos.</p>
            
            <form onSubmit={handleCreateClassroom} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                placeholder="Nombre de la nueva clase o aula..."
                value={newClassroomName}
                onChange={(e) => setNewClassroomName(e.target.value)}
                className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-sm"
              />
              <button
                type="submit"
                disabled={creatingClassroom || !newClassroomName.trim()}
                className="bg-slate-900 text-white hover:bg-slate-800 px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Plus size={16} />
                Crear Aula
              </button>
            </form>
            {classroomsError && (
              <p className="text-red-500 text-xs font-bold mt-3 bg-red-50 border border-red-100 p-3 rounded-xl">
                {classroomsError}
              </p>
            )}
          </div>

          {/* List Classrooms */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-slate-900 mb-1">No tienes aulas creadas todavía</h4>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  Crea tu primera aula de clase usando el formulario de arriba para organizar a tus estudiantes.
                </p>
              </div>
            ) : (
              classrooms.map((classroom) => {
                const classStudents = allUsers.filter(u => u.classroomId === classroom.id);
                const classProjects = allProjects.filter(p => p.classroomId === classroom.id);
                
                return (
                  <div key={classroom.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-all flex flex-col justify-between">
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
                                alert(`Código "${classroom.code}" copiado.`);
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
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          filterClassroomId === classroom.id
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {filterClassroomId === classroom.id ? 'Filtrando...' : 'Filtrar Panel'}
                      </button>
                      
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleDeleteClassroom(classroom.id)}
                          className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar aula"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Alumnos Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
            <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-blue-900">¿Cómo dar de alta a tus alumnos?</h4>
              <p className="text-xs text-blue-700 leading-relaxed mt-1">
                Los alumnos deben ingresar el código del aula que creaste al momento de registrarse. Aparecerán aquí como <strong>"Pendientes"</strong> si necesitan aprobación de acceso. 
                Usa el selector para cambiar su aula o suspender su acceso en caso necesario.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium text-sm">No se encontraron alumnos.</p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.uid} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col">
                  <div className="flex items-center gap-4 mb-4">
                    <img src={user.photoURL || 'https://lh3.googleusercontent.com/d/1DkCOqFGdw3PZbyNUnTQNgeaAGjBfv1_e'} alt="" className="w-12 h-12 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                    <div className="overflow-hidden flex-1">
                      <h3 className="font-bold text-slate-900 truncate">{user.displayName}</h3>
                      <p className="text-xs text-slate-500 truncate font-mono">{user.email}</p>
                    </div>
                    {user.status === 'approved' ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0">
                        Activo
                      </span>
                    ) : user.status === 'suspended' ? (
                      <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0">
                        Suspendido
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 animate-pulse">
                        Pendiente
                      </span>
                    )}
                  </div>

                  <div className="space-y-4 mb-4 pt-4 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Aula Asignada</label>
                      <select
                        value={user.classroomId || ''}
                        onChange={(e) => handleAssignClassroom(user.uid, e.target.value || null)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      >
                        <option value="">-- Sin Aula --</option>
                        {classrooms.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {user.projectId && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Proyecto Vinculado</span>
                          <span className="text-xs font-bold text-slate-800">
                            {allProjects.find(p => p.id === user.projectId)?.name || 'Proyecto activo'}
                          </span>
                        </div>
                        <button
                          onClick={() => resetUser(user)}
                          title="Desvincular del proyecto"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-50 flex gap-2">
                    {user.status === 'pending' ? (
                      <button
                        onClick={() => approveUser(user.uid)}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-900/10"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Aprobar Estudiante
                      </button>
                    ) : (
                      user.uid !== myUid && (
                        <button
                          onClick={() => suspendUser(user.uid, user.status)}
                          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            user.status === 'suspended'
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          {user.status === 'suspended' ? (
                            <><PlayCircle className="w-4 h-4" /> Reactivar</>
                          ) : (
                            <><PauseCircle className="w-4 h-4" /> Suspender Acceso</>
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Proyectos Tab */}
      {activeTab === 'projects' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredProjects.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
              <LayoutDashboard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium text-sm">No se encontraron proyectos en tus aulas.</p>
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all flex flex-col">
                <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{project.name}</h3>
                    <p className="text-sm text-slate-500 font-medium">{project.schoolName || 'Sin centro educativo'}</p>
                    <span className="inline-block mt-3 bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider">
                      {project.teamName || 'Equipo sin nombre'}
                    </span>
                  </div>
                  <div className="text-right">
                    <code className="text-xs font-mono font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg block tracking-wider">
                      {project.code}
                    </code>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 block">Código de Unión</span>
                  </div>
                </div>

                <div className="p-8 flex-1">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Users size={14} /> Miembros del Equipo ({project.team.length}/5)
                  </h4>
                  
                  <div className="grid gap-3">
                    {project.team.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/30">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{member.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">
                              {member.id.length >= 20 ? 'Cuenta Vinculada' : 'Nombre Guardado'}
                            </p>
                          </div>
                        </div>
                        {member.isCoordinator && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                            Coordinador
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    ID: {project.id.substring(0, 8)}...
                  </span>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => enterProjectAsMember(project.id, 'professor')}
                      className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 px-4 py-2 rounded-xl transition-all text-xs font-black uppercase tracking-wider"
                    >
                      <Eye size={14} />
                      Supervisar Proyecto
                    </button>

                    {isSuperAdmin && (
                      <button 
                        onClick={() => deleteProject(project.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar proyecto"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Evaluations Tab */}
      {activeTab === 'evaluations' && (
        <CoEvaluationsView projects={filteredProjects} users={allUsers} />
      )}
    </div>
  );
};
