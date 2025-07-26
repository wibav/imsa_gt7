// Componente para Google Analytics 4
export function GoogleAnalytics({ GA_MEASUREMENT_ID }) {
    return (
        <>
            <script
                async
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <script
                dangerouslySetInnerHTML={{
                    __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_title: document.title,
              page_location: window.location.href,
            });
          `,
                }}
            />
        </>
    )
}

// Hooks para trackear eventos personalizados
export function useAnalytics() {
    const trackEvent = (eventName, parameters = {}) => {
        if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', eventName, {
                event_category: 'engagement',
                event_label: parameters.label,
                custom_parameter_1: parameters.custom1,
                custom_parameter_2: parameters.custom2,
                ...parameters
            });
        }
    };

    const trackPageView = (url, title) => {
        if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
                page_title: title,
                page_location: url,
            });
        }
    };

    return { trackEvent, trackPageView };
}

// Eventos específicos para tu sitio
export const trackRaceView = (raceId, raceName) => {
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'view_race_results', {
            event_category: 'races',
            event_label: raceName,
            race_id: raceId,
        });
    }
};

export const trackDriverView = (driverId, driverName) => {
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'view_driver_profile', {
            event_category: 'drivers',
            event_label: driverName,
            driver_id: driverId,
        });
    }
};

export const trackDownload = (fileName, fileType) => {
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'file_download', {
            event_category: 'downloads',
            event_label: fileName,
            file_type: fileType,
        });
    }
};

// Para usar en tu layout.js, agrega esto si tienes Google Analytics:
/*
import { GoogleAnalytics } from './components/Analytics';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <GoogleAnalytics GA_MEASUREMENT_ID={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        <OrganizationStructuredData />
      </head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
*/
