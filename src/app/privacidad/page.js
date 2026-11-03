import PageHeader from "../components/PageHeader";
import { BotonPreferenciasCookies } from "../components/AvisoCookies";

export const metadata = {
    title: "Política de Privacidad | GT7 Championships",
    description: "Cómo tratamos tus datos personales en GT7 Championships (Trenkit).",
};

function Section({ id, title, children }) {
    return (
        <section id={id} className="mb-10 scroll-mt-24">
            <h2 className="text-xl font-bold text-orange-400 mb-3">{title}</h2>
            <div className="space-y-3 text-gray-300 leading-relaxed">{children}</div>
        </section>
    );
}

export default function PrivacidadPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <PageHeader
                ancho="max-w-3xl"
                migas={[{ label: 'Política de Privacidad' }]}
                icono="🔒"
                titulo="Política de Privacidad"
                subtitulo="Última actualización: noviembre de 2026"
            />
            <div className="max-w-3xl mx-auto px-4 py-12">

                <Section title="1. Responsable del tratamiento">
                    <p>
                        GT7 Championships (Trenkit) es responsable de los datos personales que se describen en esta
                        política. Contacto:{" "}
                        <a href="mailto:dasilvacristian11@gmail.com" className="text-orange-400 hover:text-orange-300">
                            dasilvacristian11@gmail.com
                        </a>.
                    </p>
                </Section>

                <Section title="2. Qué datos recogemos">
                    <ul className="list-disc list-inside space-y-1">
                        <li>Datos de cuenta: email y contraseña (gestionados por Firebase Authentication).</li>
                        <li>Datos de participación: nombre, PSN ID, GT7 ID, y resultados/sanciones asociados a los campeonatos en los que te inscribes.</li>
                        <li>Datos de facturación: al comprar un plan o lote de créditos, el pago lo procesa Paddle (ver sección 4) — no almacenamos datos de tarjetas.</li>
                        <li>Datos de uso: interacción con la plataforma, recogidos mediante Google Analytics, solo si lo aceptas (ver sección 8).</li>
                        <li>Cookies publicitarias: Google AdSense puede leer y escribir cookies para mostrar anuncios, solo si lo aceptas (ver sección 8).</li>
                    </ul>
                </Section>

                <Section title="3. Para qué usamos tus datos">
                    <p>
                        Para prestar el servicio (gestionar tu cuenta, mostrar clasificaciones e inscripciones),
                        procesar pagos, enviar notificaciones relacionadas con tu participación (por ejemplo, avisos
                        de inscripción vía Telegram si el organizador lo activa), analizar el uso del sitio para
                        mejorarlo, y cumplir obligaciones legales.
                    </p>
                </Section>

                <Section title="4. Con quién compartimos datos">
                    <p>Usamos los siguientes proveedores, que procesan datos en nuestro nombre bajo sus propias políticas de privacidad:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li><strong>Google Firebase / Google Cloud</strong> — hosting, autenticación y base de datos.</li>
                        <li><strong>Paddle.com Market Ltd</strong> — procesamiento de pagos, actuando como Merchant of Record; recibe los datos necesarios para completar tu compra (email, datos de facturación).</li>
                        <li><strong>Google Analytics</strong> — estadísticas de uso agregadas.</li>
                        <li><strong>Google AdSense</strong> — publicidad en el sitio.</li>
                        <li><strong>Telegram</strong> — solo si el organizador de tu liga activa notificaciones por ese canal.</li>
                    </ul>
                    <p>No vendemos tus datos personales a terceros.</p>
                </Section>

                <Section title="5. Dónde se procesan tus datos">
                    <p>
                        Algunos de estos proveedores (Google, Paddle) pueden procesar datos fuera del Espacio
                        Económico Europeo. En esos casos, se apoyan en mecanismos de transferencia reconocidos (como
                        las Cláusulas Contractuales Tipo de la UE).
                    </p>
                </Section>

                <Section title="6. Cuánto tiempo conservamos tus datos">
                    <p>
                        Conservamos los datos de tu cuenta mientras esté activa. Si solicitas la eliminación de tu
                        cuenta, eliminamos o anonimizamos los datos personales asociados, salvo que debamos conservar
                        algo por obligación legal (por ejemplo, registros de facturación).
                    </p>
                </Section>

                <Section title="7. Tus derechos">
                    <p>
                        Si resides en el Espacio Económico Europeo, tienes derecho a acceder, rectificar, eliminar,
                        limitar u oponerte al tratamiento de tus datos, y a la portabilidad de los mismos. Puedes
                        ejercerlos escribiendo a{" "}
                        <a href="mailto:dasilvacristian11@gmail.com" className="text-orange-400 hover:text-orange-300">
                            dasilvacristian11@gmail.com
                        </a>.
                    </p>
                </Section>

                <Section id="cookies" title="8. Cookies">
                    <p>
                        Al entrar por primera vez te mostramos un aviso para que decidas qué cookies aceptas.
                        Rechazar es tan fácil como aceptar, y la web funciona igual en ambos casos. Hasta que
                        eliges, solo se usan las necesarias.
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>
                            <strong>Necesarias</strong> (siempre activas): el idioma elegido, el campeonato
                            seleccionado, la sesión del panel de administración (Firebase Authentication) y tu
                            elección sobre cookies. Se guardan en tu navegador y no sirven para seguirte.
                        </li>
                        <li>
                            <strong>Analítica</strong> (opcional): Google Analytics a través de Firebase
                            (cookies <code>_ga</code>, <code>_ga_*</code>), para saber de forma agregada qué
                            páginas se visitan. Duración: hasta 2 años.
                        </li>
                        <li>
                            <strong>Publicidad</strong> (opcional): Google AdSense (cookies como{" "}
                            <code>__gads</code>, <code>__gpi</code>, <code>IDE</code>), para mostrar anuncios que
                            Google puede personalizar. Duración: hasta 13 meses.
                        </li>
                    </ul>
                    <p>
                        Tu elección se guarda durante esta versión del aviso; si cambian las categorías, te
                        volveremos a preguntar. Puedes cambiarla cuando quieras desde el enlace «Configurar
                        cookies» del pie de página o aquí mismo. Si retiras un permiso, borramos las cookies
                        correspondientes y recargamos la página.
                    </p>
                    <p><BotonPreferenciasCookies /></p>
                </Section>

                <Section title="9. Cambios en esta política">
                    <p>
                        Podemos actualizar esta política para reflejar cambios en el servicio o en la normativa
                        aplicable. Publicaremos la fecha de la última actualización en esta misma página.
                    </p>
                </Section>
            </div>
        </div>
    );
}
