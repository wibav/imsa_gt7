import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata = {
    title: "Política de Reembolso | GT7 Championships",
    description: "Condiciones de reembolso para lotes de créditos y planes mensuales de GT7 Championships (Trenkit).",
};

function Section({ title, children }) {
    return (
        <section className="mb-10">
            <h2 className="text-xl font-bold text-orange-400 mb-3">{title}</h2>
            <div className="space-y-3 text-gray-300 leading-relaxed">{children}</div>
        </section>
    );
}

export default function ReembolsosPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <Navbar />
            <div className="max-w-3xl mx-auto px-4 py-12">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">💳 Política de Reembolso</h1>
                <p className="text-gray-400 text-sm mb-10">Última actualización: agosto de 2026</p>

                <Section title="1. Quién procesa tu pago">
                    <p>
                        Todos los pagos se procesan a través de <strong>Paddle.com Market Ltd</strong>, que actúa como
                        Merchant of Record de la venta. Esto significa que Paddle es tu contraparte contractual para
                        el pago en sí, y aplica también su propia política de reembolsos junto con la nuestra.
                    </p>
                </Section>

                <Section title="2. Lotes de créditos (pago único)">
                    <p>
                        Los lotes de créditos no caducan y habilitan la creación de campeonatos/eventos. Si compraste
                        un lote por error y <strong>todavía no has usado ningún crédito</strong> para crear un
                        campeonato o evento, puedes solicitar el reembolso completo dentro de los 14 días posteriores
                        a la compra. Una vez que un crédito se ha usado (se creó un campeonato/evento con él), ese
                        crédito deja de ser reembolsable.
                    </p>
                </Section>

                <Section title="3. Planes mensuales (suscripción)">
                    <p>
                        Puedes cancelar tu suscripción en cualquier momento; seguirás teniendo acceso hasta el final
                        del periodo ya pagado, y no se te cobrará el siguiente ciclo. No ofrecemos reembolsos
                        parciales por el tiempo restante de un periodo ya iniciado, salvo error de cobro (cargo
                        duplicado, importe incorrecto, o cobro tras una cancelación ya confirmada), que reembolsamos
                        íntegramente al detectarlo.
                    </p>
                </Section>

                <Section title="4. Cómo solicitar un reembolso">
                    <p>
                        Escríbenos a{" "}
                        <a href="mailto:dasilvacristian11@gmail.com" className="text-orange-400 hover:text-orange-300">
                            dasilvacristian11@gmail.com
                        </a>{" "}
                        indicando el email de tu cuenta y la fecha aproximada de la compra. Respondemos en un plazo
                        máximo de 5 días hábiles. También puedes contactar directamente con el soporte de Paddle,
                        que gestiona el pago.
                    </p>
                </Section>

                <Section title="5. Cambios en esta política">
                    <p>
                        Podemos actualizar esta política para reflejar cambios en el servicio. Publicaremos la fecha
                        de la última actualización en esta misma página.
                    </p>
                </Section>
            </div>
            <Footer />
        </div>
    );
}
