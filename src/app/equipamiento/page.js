"use client";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const PRODUCTS = [
    {
        title: "Thrustmaster T300 RS GT Edition",
        description: "Force Feedback 1080°, motor brushless y 3 pedales ajustables. Licencia oficial Gran Turismo para PS5, PS4 y PC.",
        url: "https://amzn.to/47kmjsH",
        emoji: "🏎️",
        tag: "Volante",
        tagColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    },
    {
        title: "Fanatec CSL Elite — Licencia GT",
        description: "Base y pedales con licencia oficial Gran Turismo. FluxBarrier Direct Drive de Polyphony Digital. Compatible con PS5, PS4 y PC.",
        url: "https://amzn.to/40N0MoK",
        emoji: "⚡",
        tag: "Volante Premium",
        tagColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    },
    {
        title: "Thrustmaster T248",
        description: "Force Feedback 3,5 N·m, pantalla interactiva, 25 botones y 3 pedales magnéticos T3PM incluidos. PS5, PS4 y PC.",
        url: "https://amzn.to/4sz3sCC",
        emoji: "🕹️",
        tag: "Iniciación",
        tagColor: "bg-green-500/20 text-green-300 border-green-500/30",
    },
    {
        title: "Fuente Fanatec Boost Kit 180 (8Nm)",
        description: "Adaptador AC/DC compatible con Fanatec Boost Kit 180 y CSL DD / GT DD Pro. Necesario para liberar la potencia máxima de 8Nm.",
        url: "https://amzn.to/40fhME4",
        emoji: "🔌",
        tag: "Accesorio Fanatec",
        tagColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    },
    {
        title: "HORI Volante Apex (con cable)",
        description: "Volante licencia oficial PlayStation con Force Feedback. Conexión USB, compatible con PS5, PS4 y PC.",
        url: "https://amzn.to/4sorW16",
        emoji: "🎮",
        tag: "Volante",
        tagColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    },
    {
        title: "HORI Wireless Racing Wheel Apex",
        description: "Volante inalámbrico para PlayStation 5, PlayStation 4 y Windows 11/10. Sin cables, máxima libertad de movimiento.",
        url: "https://amzn.to/4rUZK6l",
        emoji: "📡",
        tag: "Inalámbrico",
        tagColor: "bg-red-500/20 text-red-300 border-red-500/30",
    },
    {
        title: "Logitech G G29 Driving Force",
        description: "Volante y pedales con Force Feedback, aluminio anodizado y palancas de cambio. Compatible con PS4, PS3 y PC vía USB.",
        url: "https://amzn.to/4srrzCV",
        emoji: "🏁",
        tag: "Volante + Pedales",
        tagColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    },
];

export default function EquipamientoPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <Navbar />

            {/* Hero */}
            <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border-b border-white/10">
                <div className="max-w-5xl mx-auto px-4 py-12 text-center">
                    <div className="text-5xl mb-4">🛒</div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
                        Equipamiento Recomendado
                    </h1>
                    <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto">
                        Selección de hardware para sacar el máximo partido a Gran Turismo 7. Todos los productos han sido
                        seleccionados pensando en los pilotos de nuestro campeonato.
                    </p>
                    <p className="text-gray-500 text-xs mt-4">
                        Como Afiliado de Amazon, obtengo ingresos por las compras adscritas que cumplen los requisitos aplicables.
                    </p>
                </div>
            </div>

            {/* Products grid */}
            <div className="max-w-5xl mx-auto px-4 py-10">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {PRODUCTS.map((product, idx) => (
                        <a
                            key={idx}
                            href={product.url}
                            target="_blank"
                            rel="noopener noreferrer sponsored"
                            className="group bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col gap-4 hover:bg-white/10 hover:border-orange-500/40 transition-all duration-200"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-4xl">{product.emoji}</span>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${product.tagColor}`}>
                                    {product.tag}
                                </span>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-white font-bold text-sm sm:text-base mb-2 group-hover:text-orange-300 transition-colors">
                                    {product.title}
                                </h2>
                                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                                    {product.description}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold group-hover:text-orange-300 transition-colors">
                                Ver en Amazon <span className="text-xs">→</span>
                            </div>
                        </a>
                    ))}
                </div>

                {/* Disclaimer */}
                <p className="text-center text-gray-600 text-xs mt-10">
                    Los precios y disponibilidad son responsabilidad de Amazon y pueden variar.
                    Como Afiliado de Amazon, obtengo ingresos por las compras adscritas que cumplen los requisitos aplicables.
                </p>
            </div>

            <Footer />
        </div>
    );
}
