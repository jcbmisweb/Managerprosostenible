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
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="max-w-lg w-full bg-white rounded-[2rem] shadow-2xl p-8 md:p-10 border border-slate-100">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 mb-2 text-center tracking-tight">Acceso Pendiente</h1>
        <p className="text-slate-500 mb-8 text-center text-sm font-medium">
          Hola, <span className="text-slate-900 font-bold">{profile?.displayName}</span>. 
          Para empezar a trabajar, introduce el código de tu aula o de un proyecto existente.
        </p>

        {error && (
          <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 p-4 rounded-xl mb-6 text-center">
            {error}
          </p>
        )}
        
        <div className="space-y-6">
          {/* Opción A: Unirse a un aula */}
          <form onSubmit={handleJoinClassroom} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
              <BookOpen size={16} className="text-emerald-500" />
              Opción A: Unirse a un Aula
            </h2>
            <p className="text-xs text-slate-500 mb-4">Introduce el código del aula proporcionado por tu profesor.</p>
            <div className="flex gap-2">
              <input
                type="text"
                required
                maxLength={6}
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="AULA12"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono tracking-widest text-center"
              />
              <button
                type="submit"
                disabled={loading || classCode.length < 3}
                className="bg-emerald-600 text-white px-5 rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight size={16} />}
                Unirse
              </button>
            </div>
          </form>

          {/* Opción B: Unirse a un proyecto */}
          <form onSubmit={handleJoinProject} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
              <Users size={16} className="text-blue-500" />
              Opción B: Unirse a un Proyecto
            </h2>
            <p className="text-xs text-slate-500 mb-4">Entra directamente al proyecto y aula de tu equipo con su código.</p>
            <div className="flex gap-2">
              <input
                type="text"
                required
                maxLength={6}
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono tracking-widest text-center"
              />
              <button
                type="submit"
                disabled={loading || projectCode.length < 6}
                className="bg-blue-600 text-white px-5 rounded-xl font-bold text-xs hover:bg-blue-700 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight size={16} />}
                Unirse
              </button>
            </div>
          </form>
        </div>
        
        <button
          onClick={logout}
          className="flex items-center justify-center w-full gap-2 mt-8 px-6 py-3 text-slate-400 hover:text-slate-600 transition-colors font-bold text-xs uppercase tracking-widest"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
