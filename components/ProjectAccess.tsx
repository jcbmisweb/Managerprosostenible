import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { db, collection, query, where, onSnapshot, doc, getDoc } from '../firebase';
import { Users, LogOut, Loader2, CheckCircle, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';

export const ProjectAccess: React.FC = () => {
  const { joinProjectById } = useProject();
  const { logout, profile } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [classroomName, setClassroomName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.classroomId) return;

    // Fetch classroom name for context
    getDoc(doc(db, 'classrooms', profile.classroomId)).then(snap => {
      if (snap.exists()) {
        setClassroomName(snap.data().name);
      }
    }).catch(err => console.error("Error fetching classroom info:", err));

    // Subscribe to projects in this classroom
    const q = query(
      collection(db, 'projects'),
      where('classroomId', '==', profile.classroomId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProjects(list);
      setLoading(false);
    }, (err) => {
      console.error("Error listening to projects:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.classroomId]);

  const handleJoin = async (projectId: string) => {
    setJoiningId(projectId);
    setError(null);
    try {
      await joinProjectById(projectId);
    } catch (err: any) {
      setError(err.message || "Error al unirse al proyecto");
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 md:p-12 space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-8 border-b border-slate-100 gap-4">
          <div>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">PROYECTOS DISPONIBLES</span>
            <h1 id="project-access-title" className="text-3xl font-black text-slate-950 tracking-tight">Acceso a tu Proyecto</h1>
            {classroomName && (
              <p className="text-sm text-slate-500 font-medium mt-1">
                Aula asignada: <strong className="text-slate-800">{classroomName}</strong>
              </p>
            )}
          </div>
          <button 
            onClick={logout} 
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-2xl border border-slate-100 transition-all text-xs font-black uppercase tracking-wider"
          >
            <LogOut size={14} />
            Cerrar Sesión
          </button>
        </div>

        {/* ERROR BOX */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
            <div className="bg-red-100 p-2 rounded-xl text-red-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-900">Hubo un error al unirte</h4>
              <p className="text-xs text-red-700 leading-relaxed mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* PROJECTS SECTION */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
            <p className="text-sm font-semibold tracking-wide">Cargando proyectos del aula...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="py-16 text-center max-w-lg mx-auto space-y-6">
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto border border-blue-100 shadow-inner">
              <Sparkles size={32} className="animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Proyectos pendientes de creación</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                Tu profesor aún no ha habilitado proyectos para esta aula. Por favor, pídele a tu profesor que pre-cree los proyectos en su panel docente para que tú y tu equipo podáis uniros y comenzar.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
              <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-900">¿Cómo unirte con tu equipo?</h4>
                <p className="text-xs text-emerald-700 leading-relaxed mt-1">
                  Ponte de acuerdo con tus compañeros y elegid uno de los proyectos libres de abajo. 
                  Podréis uniros hasta un máximo de <strong>5 alumnos por proyecto</strong>. 
                  Una vez estéis todos dentro, vuestro coordinador propondrá cerrar el grupo para que el profesor lo valide.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {projects.map((project) => {
                const team = project.team || [];
                const isFull = team.length >= 5;
                const isClosed = project.isTeamClosed || project.isTeamClosedProposed;
                
                return (
                  <div 
                    key={project.id} 
                    className={`border-2 rounded-[2rem] p-6 flex flex-col justify-between transition-all ${
                      isClosed 
                        ? 'border-slate-100 bg-slate-50/50 opacity-60' 
                        : isFull 
                        ? 'border-slate-200 bg-slate-50/20' 
                        : 'border-slate-100 hover:border-emerald-500 bg-white hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isClosed 
                            ? 'bg-slate-200 text-slate-600 border border-slate-300' 
                            : isFull 
                            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {isClosed ? 'Cerrado/Validando' : isFull ? 'Lleno (5/5)' : `Libre (${team.length}/5)`}
                        </span>
                        
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          ID: {project.id.substring(0, 6).toUpperCase()}
                        </span>
                      </div>

                      <h3 className="text-xl font-black text-slate-900 tracking-tight mb-4">
                        {project.name}
                      </h3>

                      {/* TEAM MEMBERS LIST */}
                      <div className="space-y-2 mb-6">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                          Alumnos ya unidos:
                        </span>
                        {team.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Proyecto totalmente vacío, ¡sé el primero en entrar!</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {team.map((member: any) => (
                              <div 
                                key={member.id} 
                                className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/60 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700"
                              >
                                <span className="w-4 h-4 rounded-full bg-slate-300 text-[10px] font-bold text-slate-700 flex items-center justify-center">
                                  {member.name.charAt(0).toUpperCase()}
                                </span>
                                {member.name}
                                {member.isCoordinator && (
                                  <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded font-bold">Coord</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      disabled={isClosed || isFull || !!joiningId}
                      onClick={() => handleJoin(project.id)}
                      className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                        isClosed
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : isFull
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : joiningId === project.id
                          ? 'bg-emerald-600 text-white cursor-wait'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md'
                      }`}
                    >
                      {joiningId === project.id ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Uniéndome...
                        </>
                      ) : isClosed ? (
                        'No disponible'
                      ) : isFull ? (
                        'Proyecto Completo'
                      ) : (
                        <>
                          Unirme a este proyecto
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
