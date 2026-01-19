import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="mt-16 border-t border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-950 text-gray-300">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid gap-8 md:grid-cols-4">
                    {/* Brand */}
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                            <Image src="/logo_gt7.png" alt="GT7 Championships" width={40} height={40} className="w-10 h-10 object-contain" />
                            <span className="text-white font-bold text-lg">IMSA GT7 Racing Club ESP</span>
                        </div>
                        <p className="text-gray-400 max-w-prose">
                            Resultados, clasificaciones y calendario del campeonato. Datos claros, en tiempo real y con una experiencia optimizada para escritorio y móvil.
                        </p>
                    </div>

                    {/* Enlaces rápidos */}
                    <div>
                        <h3 className="text-white font-semibold mb-3">Enlaces</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
                            </li>
                            <li>
                                <Link href="/login" className="hover:text-white transition-colors">Acceso Admin</Link>
                            </li>
                            <li>
                                <Link href="https://imsa.trenkit.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Sitio oficial</Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contacto y redes */}
                    <div>
                        <h3 className="text-white font-semibold mb-3">Contacto</h3>
                        <ul className="space-y-2 mb-6">
                            <li>
                                <a href="mailto:dasilvacristian11@gmail.com" className="hover:text-white transition-colors flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M2.25 6.75A2.25 2.25 0 0 1 4.5 4.5h15a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 19.5 19.5h-15A2.25 2.25 0 0 1 2.25 17.25V6.75Zm2.4-.75a.75.75 0 0 0-.6.3 89 89 0 0 0 7.58 5.44.75.75 0 0 0 .74 0A89 89 0 0 0 20 6.3a.75.75 0 0 0-.6-.3H4.65Z" /></svg>
                                    dasilvacristian11@gmail.com
                                </a>
                            </li>
                        </ul>

                        <h3 className="text-white font-semibold mb-3">Redes</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="https://www.linkedin.com/in/cristian-da-silva-zerpa/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4v13h-4v-13zM8.5 8.5h3.8v1.8h.1c.5-.9 1.7-1.8 3.4-1.8 3.6 0 4.2 2.3 4.2 5.2v7.8h-4v-6.9c0-1.7 0-3.8-2.3-3.8s-2.6 1.8-2.6 3.7v7h-4v-13z" /></svg>
                                    LinkedIn
                                </Link>
                            </li>
                            <li>
                                <Link href="https://www.youtube.com/@DeshBourne" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.8 31.8 0 0 0 0 12a31.8 31.8 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-3.8.5-5.8s0-3.9-.5-5.8ZM9.75 15.02v-6l6 3-6 3Z" /></svg>
                                    YouTube
                                </Link>
                            </li>
                            <li>
                                <Link href="https://www.twitch.tv/deshbourne" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 3h16v10.5l-4 4H11l-3 3H6v-3H2V5l2-2Zm2 2v10h3v3l3-3h4l2-2V5H6Zm8 2h2v5h-2V7Zm-5 0h2v5H9V7Z" /></svg>
                                    Twitch
                                </Link>
                            </li>
                            <li>
                                <Link href="https://buymeacoffee.com/wolcutorb" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-.766-1.615a3.19 3.19 0 0 0-1.548-1.066c-.611-.195-1.28-.242-1.94-.12a4.19 4.19 0 0 0-1.675.637l-.343.236-.343-.236a4.19 4.19 0 0 0-1.675-.637c-.66-.122-1.329-.075-1.94.12a3.19 3.19 0 0 0-1.548 1.066c-.378.452-.647 1.017-.766 1.615l-.132.666c-.15.754-.09 1.535.17 2.256.26.721.706 1.365 1.288 1.856l4.468 3.764c.165.14.407.14.572 0l4.468-3.764a4.24 4.24 0 0 0 1.288-1.856c.26-.721.32-1.502.17-2.256zM7.288 18.675h9.424v1.5H7.288v-1.5z" /></svg>
                                    Buy Me a Coffee
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10 pt-6">
                    <p className="text-sm text-gray-400">© {year} GT7 Championships. Todos los derechos reservados.</p>
                    <p className="text-xs text-gray-500">Desarrollado con Next.js y Tailwind CSS.</p>
                </div>
            </div>
        </footer>
    );
}
