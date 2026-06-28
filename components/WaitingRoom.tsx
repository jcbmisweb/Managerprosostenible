import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, LogOut, ArrowRight, Loader2, BookOpen, Users } from 'lucide-react';
import { db, collection, query, where, getDocs, updateDoc, doc, OperationType, handleFirestoreError } from '../firebase';

export const WaitingRoom: React.FC = () => {
  const { logout, profile } = useAuth();
  const [classCode, setClassCode] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode.trim() || !profile) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'classrooms'), where('code', '==', classCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error("Código de aula no encontrado.");
      }
      const classroom = snap.docs[0].data();
      await updateDoc(doc(db, 'users', profile.uid), {
        classroomId: classroom.id,
        status: 'approved'
      });
    } catch (err: any) {
      setError(err.message || "Error al unirse al aula");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectCode.trim() || !profile) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'projects'), where('code', '==', projectCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error("Código de proyecto no encontrado.");
      }
      const project = snap.docs[0].data();
      await updateDoc(doc(db, 'users', profile.uid), {
        projectId: project.id,
        classroomId: project.classroomId || null,
        status: 'approved'
      });
    } catch (err: any) {
      setError(err.message || "Error al unirse al proyecto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <BookOpen className="text-emerald-600" size={28} />
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Manager pro Sostenible</h1>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-8 flex flex-col md:flex-row gap-8 items-start mt-8">
        
        {/* Left Column: Student Profile */}
        <div className="w-full md:w-1/3 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-center">
          <div className="relative inline-block mb-4">
            <img 
              src={profile?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} 
              alt="Profile" 
              className="w-24 h-24 rounded-full border-4 border-slate-50 mx-auto shadow-sm"
            />
            <div className="absolute bottom-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-lg border-2 border-white shadow-sm uppercase tracking-wider">
              ALUMNO
            </div>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-1">{profile?.displayName}</h2>
          <p className="text-slate-500 text-sm mb-6 font-medium">{profile?.email}</p>
          
          <div className="bg-amber-50 text-amber-800 text-xs font-bold p-4 rounded-2xl flex flex-col items-center gap-2 border border-amber-100">
            <Clock className="w-6 h-6 text-amber-500 mb-1" />
            <span>Esperando asignación</span>
            <span className="text-amber-600 font-medium text-center">Tu cuenta está pendiente de unirse a un aula o proyecto.</span>
          </div>
        </div>

        {/* Right Column: Actions (Join Classroom/Project) */}
        <div className="w-full md:w-2/3 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Acceso a tu espacio</h2>
            <p className="text-slate-500 text-sm mb-8">
              Si tu profesor te ha proporcionado un código, introdúcelo a continuación para acceder a tu aula o proyecto. 
              Si te han indicado que tu cuenta cambiará a perfil de profesor, espera a que un administrador aplique el cambio.
            </p>

            {error && (
              <p className="text-sm font-bold text-red-600 bg-red-50 border border-red-100 p-4 rounded-2xl mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 block"></span>
                {error}
              </p>
            )}

            <div className="space-y-6">
              {/* Opción A: Unirse a un aula */}
              <form onSubmit={handleJoinClassroom} className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
                  <BookOpen size={16} className="text-emerald-500" />
                  Opción A: Unirse a un Aula
                </h3>
                <p className="text-xs text-slate-500 mb-4 font-medium">Introduce el código del aula proporcionado por tu profesor para empezar a crear proyectos.</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    placeholder="AULA12"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono tracking-widest text-center shadow-inner bg-white"
                  />
                  <button
                    type="submit"
                    disabled={loading || classCode.length < 3}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight size={16} />}
                    Unirse
                  </button>
                </div>
              </form>

              {/* Opción B: Unirse a un proyecto */}
              <form onSubmit={handleJoinProject} className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
                  <Users size={16} className="text-blue-500" />
                  Opción B: Unirse a un Proyecto
                </h3>
                <p className="text-xs text-slate-500 mb-4 font-medium">Si ya tienes un equipo asignado, entra directamente con el código del proyecto.</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono tracking-widest text-center shadow-inner bg-white"
                  />
                  <button
                    type="submit"
                    disabled={loading || projectCode.length < 6}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-xs hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight size={16} />}
                    Unirse
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
