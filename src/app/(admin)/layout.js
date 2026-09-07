import AdminLayout from '../components/AdminLayout';

/**
 * Chrome común de todo el panel de administración: menú lateral, cabecera y
 * cierre de sesión.
 *
 * Es un route group —los paréntesis no aparecen en la URL—, así que
 * /tracksAdmin, /pilotsAdmin y compañía siguen respondiendo donde siempre.
 *
 * Antes cada sección tenía su propio layout.js con estas mismas cuatro líneas:
 * diez archivos byte a byte idénticos salvo el nombre de la función. Nada
 * obligaba a crearlo, así que al añadir /pilotsAdmin se olvidó y esa pantalla
 * se quedó sin menú y sin forma de salir. Con un único layout compartido, una
 * sección nueva lo hereda por estar aquí dentro.
 */
export default function AdminSectionsLayout({ children }) {
    return <AdminLayout>{children}</AdminLayout>;
}
