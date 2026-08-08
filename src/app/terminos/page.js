import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata = {
    title: "Términos de Servicio | GT7 Championships",
    description: "Términos y condiciones de uso de la plataforma GT7 Championships (Trenkit).",
};

function Section({ title, children }) {
    return (
        <section className="mb-10">
            <h2 className="text-xl font-bold text-orange-400 mb-3">{title}</h2>
            <div className="space-y-3 text-gray-300 leading-relaxed">{children}</div>
        </section>
    );
}

export default function TerminosPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <Navbar />
            <div className="max-w-3xl mx-auto px-4 py-12">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">📋 Términos de Servicio</h1>
                <p className="text-gray-400 text-sm mb-10">Última actualización: agosto de 2026</p>

                <Section title="1. Sobre este servicio">
                    <p>
                        GT7 Championships (marca operada por Trenkit, en adelante &ldquo;nosotros&rdquo; o &ldquo;la plataforma&rdquo;) es un
                        servicio online para organizar y publicar campeonatos y eventos de simracing (Gran Turismo 7):
                        calendario, inscripciones, clasificaciones, sanciones y reclamaciones. Al crear una cuenta o
                        usar la plataforma aceptas estos términos.
                    </p>
                </Section>

                <Section title="2. Cuentas y organizaciones">
                    <p>
                        Cada organización (liga) tiene un responsable (&ldquo;Organizador&rdquo;) que administra su cuenta,
                        invita administradores y comisarios, y es responsable del contenido que publica (nombres de
                        campeonatos, reglamentos, resultados, resolución de reclamaciones). Eres responsable de mantener
                        la confidencialidad de tus credenciales de acceso.
                    </p>
                </Section>

                <Section title="3. Planes, créditos y pagos">
                    <p>
                        La plataforma ofrece un plan gratuito con límites, lotes de créditos de pago único (no caducan,
                        cada crédito habilita la creación de un campeonato o evento) y planes de suscripción mensual
                        con límites ampliados y funciones adicionales. Los precios vigentes se muestran en la página de
                        Facturación antes de cada compra.
                    </p>
                    <p>
                        Los pagos se procesan a través de <strong>Paddle.com Market Ltd</strong>, que actúa como
                        Merchant of Record (comerciante registrado) de esta venta. Paddle gestiona el cobro, la
                        facturación, los impuestos aplicables y el cumplimiento normativo del pago; sus propios
                        términos y política de privacidad también aplican a la transacción.
                    </p>
                </Section>

                <Section title="4. Cancelación">
                    <p>
                        Puedes cancelar una suscripción mensual en cualquier momento desde la página de Facturación o
                        contactándonos; la cancelación se hace efectiva al final del periodo ya pagado. Los lotes de
                        créditos, al ser un pago único sin caducidad, no requieren cancelación.
                    </p>
                </Section>

                <Section title="5. Uso aceptable">
                    <p>
                        No está permitido: usar la plataforma para fines ilegales, introducir contenido difamatorio,
                        ofensivo o que infrinja derechos de terceros, intentar vulnerar la seguridad del servicio, ni
                        revender el acceso a la plataforma sin autorización.
                    </p>
                </Section>

                <Section title="6. Disponibilidad y responsabilidad">
                    <p>
                        Hacemos lo razonablemente posible por mantener el servicio disponible, pero no garantizamos un
                        funcionamiento ininterrumpido. En la medida permitida por la ley, no somos responsables de
                        daños indirectos derivados del uso de la plataforma. Nada en estos términos limita
                        responsabilidades que no puedan excluirse legalmente.
                    </p>
                </Section>

                <Section title="7. Cambios en estos términos">
                    <p>
                        Podemos actualizar estos términos para reflejar cambios en el servicio o en la normativa
                        aplicable. Publicaremos la fecha de la última actualización en esta misma página.
                    </p>
                </Section>

                <Section title="8. Contacto">
                    <p>
                        Para cualquier consulta sobre estos términos, escríbenos a{" "}
                        <a href="mailto:dasilvacristian11@gmail.com" className="text-orange-400 hover:text-orange-300">
                            dasilvacristian11@gmail.com
                        </a>.
                    </p>
                </Section>
            </div>
            <Footer />
        </div>
    );
}
