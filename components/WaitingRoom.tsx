import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, LogOut, Loader2, BookOpen, Users, Edit2, Check, X, ShieldCheck, Award } from 'lucide-react';

export const WaitingRoom: React.FC = () => {
  const { logout, profile, updateProfile } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(profile?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.displayName) {
      setTempName(profile.displayName);
    }
  }, [profile]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim() || !profile) return;
    setLoading(true);
    setError(null);
    try {
      await updateProfile({ displayName: tempName.trim() });
      setIsEditingName(false);
    } catch (err: any) {
      setError("Error al actualizar el nombre");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="waiting-room-root" className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header id="waiting-room-header" className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <BookOpen className="text-emerald-600" size={28} />
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Manager pro Sostenible</h1>
        </div>
        <button
          id="btn-waiting-room-logout"
          onClick={logout}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </header>

      {/* Main Content */}
      <main id="waiting-room-main" className="flex-1 max-w-4xl w-full mx-auto p-8 flex flex-col md:flex-row gap-8 items-start mt-8">
        
        {/* Left Column: Student Profile Editor */}
        <div id="student-profile-card" className="w-full md:w-1/3 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-center">
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

          {isEditingName ? (
            <form onSubmit={handleUpdateName} className="space-y-3 mt-2">
              <input
                id="input-edit-profile-name"
                type="text"
                required
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Tu nombre completo"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center font-semibold"
                maxLength={40}
              />
              <div className="flex justify-center gap-2">
                <button
                  id="btn-save-profile-name"
                  type="submit"
                  disabled={loading || !tempName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition-all disabled:opacity-50"
                  title="Guardar"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} />}
                </button>
                <button
                  id="btn-cancel-profile-name"
                  type="button"
                  onClick={() => {
                    setTempName(profile?.displayName || '');
                    setIsEditingName(false);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition-all"
                  title="Cancelar"
                >
                  <X size={16} />
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-2 group">
              <div className="flex items-center justify-center gap-2">
                <h2 id="student-name-display" className="text-xl font-black text-slate-900 tracking-tight">{profile?.displayName || 'Sin Nombre'}</h2>
                <button 
                  id="btn-trigger-edit-name"
                  onClick={() => setIsEditingName(true)} 
                  className="text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Editar nombre"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            </div>
          )}

          <p className="text-slate-500 text-sm mb-6 font-medium mt-1">{profile?.email}</p>
          
          <div id="waiting-status-box" className="bg-amber-50 text-amber-800 text-xs font-bold p-4 rounded-2xl flex flex-col items-center gap-2 border border-amber-100">
            <Clock className="w-6 h-6 text-amber-500 mb-1 animate-pulse" />
            <span>Esperando asignación de aula</span>
            <span className="text-amber-600 font-medium text-center leading-relaxed">
              Tu profesor te agregará directamente a tu clase. Por favor, asegúrate de que tu nombre sea correcto.
            </span>
          </div>

          {error && (
            <p className="text-xs text-red-600 mt-3 font-semibold bg-red-50 p-2 rounded-lg border border-red-100">
              {error}
            </p>
          )}
        </div>

        {/* Right Column: Dynamic Informational / Instructions Cards */}
        <div id="instructions-column" className="w-full md:w-2/3 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <h2 id="instructions-title" className="text-2xl font-black text-slate-900 mb-2 tracking-tight">¡Bienvenido al Manager Sostenible!</h2>
            <p className="text-slate-500 text-sm mb-8">
              Hemos simplificado el proceso de acceso para aligerar la plataforma y evitar errores de registro en el limbo. 
              Ahora no necesitas buscar ningún código. Sigue estos pasos:
            </p>

            <div className="space-y-6">
              {/* Step 1 */}
              <div id="step-1-card" className="flex gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-sm shadow-sm">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base mb-1">Nombre y Perfil Listo</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Asegúrate de cambiar tu nombre en la tarjeta de la izquierda si es necesario. Tu profesor te identificará en su base de datos de perfiles utilizando tu nombre completo y correo electrónico.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div id="step-2-card" className="flex gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-sm shadow-sm">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base mb-1">Asignación Automática de Aula</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Tu profesor te buscará y te asignará directamente a tu Aula. Cuando lo haga, al recargar la web o de forma automática, accederás a tu panel con todos los contenidos habilitados.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div id="step-3-card" className="flex gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold text-sm shadow-sm">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base mb-1">Unirte a tu Proyecto de Equipo</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Una vez asignado a tu Aula, tu profesor creará una lista de proyectos aprobados con nombres aleatorios por defecto. Podrás unirte al proyecto que te corresponda junto a tus compañeros hasta completar el grupo (máximo 5 personas).
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3 text-slate-400">
              <ShieldCheck className="text-emerald-500" size={18} />
              <p className="text-xs font-semibold text-slate-500">Garantizamos que todas las cuentas están registradas de forma segura y centralizada en el Registro de Control de Accesos.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
