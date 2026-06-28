import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { WaitingRoom } from '../components/WaitingRoom';
import { ProjectAccess } from '../components/ProjectAccess';
import { Dashboard } from './Dashboard';
import { GraduationCap, Clock, ClipboardList, Users, CheckCircle2 } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { state } = useProject();

  // 1. If no classroom is assigned, show the informative message and wait screen (which embeds WaitingRoom)
  if (!profile?.classroomId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <WaitingRoom />
      </div>
    );
  }

  // 2. If classroom is assigned, but no project is assigned
  if (!profile?.projectId) {
    return <ProjectAccess />;
  }

  // 3. If classroom and project are both assigned, show progress summary followed by the full Dashboard
  const totalTasks = state.checklist.length;
  const completedTasks = state.checklist.filter(item => item.status === 'completed').length;
  const inProgressTasks = state.checklist.filter(item => item.status === 'in_progress').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-8 pb-16">
      {/* Resumen de Progreso Actual Card (Bento style) */}
      <div className="max-w-6xl mx-auto px-10 pt-10">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-30%] left-[-5%] w-60 h-60 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
            <div className="space-y-3 max-w-xl">
              <span className="bg-white/20 text-white font-bold text-xs uppercase tracking-widest px-3.5 py-1.5 rounded-full inline-flex items-center gap-2">
                <GraduationCap size={14} />
                Progreso del Alumno
              </span>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
                Estado Actual de tu Proyecto
              </h1>
              <p className="text-emerald-100 font-medium text-sm leading-relaxed">
                Estás trabajando en el proyecto <strong className="text-white underline decoration-wavy">{state.name || 'Proyecto activo'}</strong>. 
                Aquí tienes una vista general de tu avance académico y los hitos completados con tu equipo.
              </p>
            </div>

            {/* Completion Circular Progress or Big Stat */}
            <div className="bg-white/10 p-6 rounded-3xl border border-white/10 flex items-center gap-6 shrink-0 w-full lg:w-auto">
              <div className="relative flex items-center justify-center">
                {/* Visual Circle Meter */}
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="34" className="stroke-white/10 fill-none" strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" className="stroke-white fill-none transition-all duration-500 ease-out" strokeWidth="6" strokeDasharray="213.6" strokeDashoffset={213.6 - (213.6 * completionRate) / 100} strokeLinecap="round" />
                </svg>
                <span className="absolute font-black text-xl text-white">{completionRate}%</span>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-emerald-200 uppercase tracking-wider">Hitos de Aprendizaje</p>
                <p className="text-2xl font-black">{completedTasks} / {totalTasks}</p>
                <p className="text-xs text-emerald-100 font-medium">Tareas completadas</p>
              </div>
            </div>
          </div>

          {/* Micro stats banner inside the header */}
          <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[9px] font-black text-emerald-200 uppercase block tracking-wider">En Progreso</span>
              <span className="text-lg font-black flex items-center gap-1.5 mt-0.5">
                <Clock size={16} className="text-emerald-300" />
                {inProgressTasks}
              </span>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[9px] font-black text-emerald-200 uppercase block tracking-wider">Pendientes</span>
              <span className="text-lg font-black flex items-center gap-1.5 mt-0.5">
                <ClipboardList size={16} className="text-emerald-300" />
                {totalTasks - completedTasks - inProgressTasks}
              </span>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5 col-span-2">
              <span className="text-[9px] font-black text-emerald-200 uppercase block tracking-wider">Miembros Activos</span>
              <span className="text-sm font-bold flex items-center gap-2 mt-1 truncate">
                <Users size={16} className="text-emerald-300 shrink-0" />
                {state.team.map(m => m.name).join(', ') || 'Sin miembros'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Renders the full project Dashboard */}
      <Dashboard />
    </div>
  );
};
