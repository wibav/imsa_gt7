"use client";
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminNavigation({ currentPage }) {
    const { currentUser, logout, isAdmin } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await logout();
            router.push('/');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    };

    const navigateTo = (path) => {
        router.push(path);
    };

    return (
        <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header Principal */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <span className="text-4xl">⚙️</span>
                            Panel de Administración
                        </h1>
                        <p className="text-orange-100 text-lg mt-1">IMSA GT7 Racing Club ESP</p>
                    </div>

                    {/* Usuario Info */}
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                        <span className="text-white text-sm">
                            👤 {currentUser?.email}
                        </span>
                        {isAdmin() && (
                            <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                                ADMIN
                            </span>
                        )}
                    </div>
                </div>

                {/* Navegación */}
                <div className="flex flex-wrap gap-4">
                    {/* Volver al Dashboard */}
                    <button
                        onClick={() => navigateTo('/')}
                        className="bg-white/20 text-white px-6 py-3 rounded-lg font-bold hover:bg-white/30 transition-all duration-200 flex items-center gap-2"
                    >
                        🏠 Dashboard Principal
                    </button>

                    {/* Admin Equipos */}
                    <button
                        onClick={() => navigateTo('/teamsAdmin')}
                        className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 flex items-center gap-2 ${currentPage === 'teams'
                                ? 'bg-white text-orange-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                    >
                        🏎️ Admin Equipos
                    </button>

                    {/* Admin Pistas */}
                    <button
                        onClick={() => navigateTo('/tracksAdmin')}
                        className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 flex items-center gap-2 ${currentPage === 'tracks'
                                ? 'bg-white text-orange-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                    >
                        🏁 Admin Pistas
                    </button>

                    {/* Admin Eventos */}
                    <button
                        onClick={() => navigateTo('/eventsAdmin')}
                        className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 flex items-center gap-2 ${currentPage === 'events'
                                ? 'bg-white text-orange-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                    >
                        🎉 Admin Eventos
                    </button>

                    {/* Separador */}
                    <div className="flex-1"></div>

                    {/* Cerrar Sesión */}
                    <button
                        onClick={handleLogout}
                        className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg font-bold hover:from-red-700 hover:to-red-800 transition-all duration-200 flex items-center gap-2"
                    >
                        🚪 Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
    );
}