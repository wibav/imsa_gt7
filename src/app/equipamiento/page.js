"use client";
import { useState, useEffect } from "react";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { FirebaseService } from "../services/firebaseService";

export default function EquipamientoPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        FirebaseService.getEquipmentItems()
            .then(setProducts)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <PageHeader
                ancho="max-w-5xl"
                migas={[{ label: 'Equipamiento' }]}
                icono="🛒"
                titulo="Equipamiento Recomendado"
                subtitulo="Selección de hardware para sacar el máximo partido a Gran Turismo 7. Todos los productos han sido seleccionados pensando en los pilotos de nuestro campeonato."
            >
                <p className="text-white/60 text-xs">
                    Como Afiliado de Amazon, obtengo ingresos por las compras adscritas que cumplen los requisitos aplicables.
                </p>
            </PageHeader>

            {/* Products grid */}
            <div className="max-w-5xl mx-auto px-4 py-10">
                {loading ? (
                    <p className="text-center text-gray-400 text-sm">Cargando…</p>
                ) : products.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm">No hay productos disponibles por el momento.</p>
                ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => (
                        <a
                            key={product.id}
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
                )}

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
