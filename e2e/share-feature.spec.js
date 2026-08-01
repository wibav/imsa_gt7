// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';

test.describe('Feature de Share Social - Campeonatos y Eventos', () => {
    test.beforeEach(async ({ page }) => {
        // Configurar viewport para desktop
        await page.setViewportSize({ width: 1280, height: 720 });
    });

    test('1. Botón compartir visible en página de campeonatos', async ({ page }) => {
        // Navegar a la página de campeonatos (listado)
        await page.goto(`${BASE_URL}/championships.html`);
        await page.waitForLoadState('networkidle');

        // Tomar screenshot del estado inicial
        await page.screenshot({ path: 'e2e-screenshots/championships-list-inicial.png' });
    });

    test('2. Botón compartir en detalle de campeonato - estados y UX', async ({ page }) => {
        // Navegar a un campeonato específico (usando un ID real del build)
        await page.goto(`${BASE_URL}/championships.html?id=EmPr0pZG1SPGWQbubvRx`);
        await page.waitForLoadState('networkidle');

        // Tomar screenshot de la página completa
        await page.screenshot({ path: 'e2e-screenshots/championship-detail-full.png', fullPage: true });

        // Verificar que existe el botón de compartir
        const shareButton = page.locator('button:has-text("Compartir")');
        await expect(shareButton).toBeVisible({ timeout: 10000 });

        // Verificar atributos de accesibilidad
        await expect(shareButton).toHaveAttribute('title', /compartir/i);
        await expect(shareButton).toHaveAttribute('aria-label', /.+/);

        // Verificar estilos visuales del botón
        const buttonClasses = await shareButton.getAttribute('class');
        expect(buttonClasses).toContain('bg-blue-600');

        // Tomar screenshot del botón en estado normal
        await shareButton.screenshot({ path: 'e2e-screenshots/share-button-normal.png' });

        // Verificar estado hover
        await shareButton.hover();
        await page.waitForTimeout(200);
        await shareButton.screenshot({ path: 'e2e-screenshots/share-button-hover.png' });

        // Simular click y capturar el estado "copiado"
        await shareButton.click();
        await page.waitForTimeout(500);

        // Verificar que el botón muestra feedback de éxito
        const copiedText = page.locator('button:has-text("¡Copiado!")');
        await expect(copiedText).toBeVisible({ timeout: 2000 });

        await page.screenshot({ path: 'e2e-screenshots/share-button-copied.png' });

        // Esperar que el estado vuelva a normal
        await page.waitForTimeout(2500);
        await expect(shareButton).toBeVisible();
        await expect(copiedText).not.toBeVisible();
    });

    test('3. URL de share generada es correcta', async ({ page }) => {
        await page.goto(`${BASE_URL}/championships.html?id=EmPr0pZG1SPGWQbubvRx`);
        await page.waitForLoadState('networkidle');

        // Interceptar llamadas al clipboard
        let clipboardText = '';
        await page.addInitScript(() => {
            window.lastClipboardText = '';
            const originalWriteText = navigator.clipboard.writeText;
            navigator.clipboard.writeText = async (text) => {
                window.lastClipboardText = text;
                return Promise.resolve();
            };
        });

        const shareButton = page.locator('button:has-text("Compartir")');
        await shareButton.click();
        await page.waitForTimeout(500);

        // Obtener el texto copiado
        clipboardText = await page.evaluate(() => window.lastClipboardText);

        // Verificar que la URL tiene el formato correcto
        expect(clipboardText).toMatch(/https:\/\/imsa\.trenkit\.com\/share\/championship\/EmPr0pZG1SPGWQbubvRx\//);

        console.log('URL de share generada:', clipboardText);
    });

    test('4. Página de share tiene metadata OG correcta', async ({ page }) => {
        // Navegar directamente a una página de share
        await page.goto(`${BASE_URL}/share/championship/EmPr0pZG1SPGWQbubvRx/index.html`);
        await page.waitForLoadState('networkidle');

        // Verificar meta tags Open Graph
        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
        const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
        const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
        const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');

        expect(ogTitle).toBeTruthy();
        expect(ogDescription).toBeTruthy();
        expect(ogImage).toContain('firebasestorage.googleapis.com');
        expect(ogUrl).toContain('/share/championship/EmPr0pZG1SPGWQbubvRx/');

        // Verificar meta tags Twitter
        const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
        expect(twitterCard).toBe('summary_large_image');

        // Tomar screenshot de la página de share
        await page.screenshot({ path: 'e2e-screenshots/share-page-championship.png', fullPage: true });

        console.log('Metadata OG:', { ogTitle, ogDescription, ogUrl });
    });

    test('5. Página de share redirige correctamente (sin ser crawler)', async ({ page }) => {
        // Navegar a página de share (como usuario normal, no crawler)
        const response = await page.goto(`${BASE_URL}/share/championship/EmPr0pZG1SPGWQbubvRx/index.html`);

        // Esperar un poco para que el redirect JS se ejecute
        await page.waitForTimeout(1000);

        // Verificar que se redirigió a la página real del campeonato
        expect(page.url()).toContain('/championships');
        expect(page.url()).toContain('id=EmPr0pZG1SPGWQbubvRx');
    });

    test('6. Botón compartir en eventos - verificar presencia', async ({ page }) => {
        // Navegar a listado de eventos
        await page.goto(`${BASE_URL}/events.html`);
        await page.waitForLoadState('networkidle');

        await page.screenshot({ path: 'e2e-screenshots/events-list.png', fullPage: true });

        // Buscar si hay algún evento para entrar a detalle
        const eventCards = page.locator('[class*="event"], [class*="card"]');
        const count = await eventCards.count();

        console.log(`Eventos encontrados en listado: ${count}`);
    });

    test('7. Responsive - botón share en mobile', async ({ page }) => {
        // Configurar viewport móvil
        await page.setViewportSize({ width: 375, height: 667 });

        await page.goto(`${BASE_URL}/championships.html?id=EmPr0pZG1SPGWQbubvRx`);
        await page.waitForLoadState('networkidle');

        // Verificar que el botón sigue visible y funcional
        const shareButton = page.locator('button:has-text("Compartir")');
        await expect(shareButton).toBeVisible();

        // Verificar que no está cortado o fuera de la pantalla
        const boundingBox = await shareButton.boundingBox();
        expect(boundingBox).toBeTruthy();
        expect(boundingBox.x).toBeGreaterThanOrEqual(0);
        expect(boundingBox.y).toBeGreaterThanOrEqual(0);

        await page.screenshot({ path: 'e2e-screenshots/share-button-mobile.png', fullPage: true });
    });

    test('8. Consistencia visual - comparar con otros botones de acción', async ({ page }) => {
        await page.goto(`${BASE_URL}/championships.html?id=EmPr0pZG1SPGWQbubvRx`);
        await page.waitForLoadState('networkidle');

        // Capturar el área de botones de acción en el header
        const headerButtons = page.locator('div:has(button:has-text("Compartir"))').first();
        await headerButtons.screenshot({ path: 'e2e-screenshots/header-action-buttons.png' });
    });

    test('9. Manejo de errores - simular fallo de clipboard', async ({ page }) => {
        await page.goto(`${BASE_URL}/championships.html?id=EmPr0pZG1SPGWQbubvRx`);
        await page.waitForLoadState('networkidle');

        // Simular que el clipboard falla
        await page.addInitScript(() => {
            navigator.clipboard.writeText = async () => {
                throw new Error('Clipboard access denied');
            };
            navigator.share = undefined;
        });

        const shareButton = page.locator('button:has-text("Compartir")');
        await shareButton.click();
        await page.waitForTimeout(500);

        // Verificar que muestra estado de error
        const errorButton = page.locator('button:has-text("Error")');
        await expect(errorButton).toBeVisible({ timeout: 2000 });

        await page.screenshot({ path: 'e2e-screenshots/share-button-error.png' });
    });

    test('10. Verificar página share not-found', async ({ page }) => {
        await page.goto(`${BASE_URL}/share/championship/not-found/index.html`);
        await page.waitForLoadState('networkidle');

        // Verificar que existe contenido de fallback
        const title = await page.locator('meta[property="og:title"]').getAttribute('content');
        expect(title).toContain('Campeonato');

        await page.screenshot({ path: 'e2e-screenshots/share-page-not-found.png', fullPage: true });
    });
});
