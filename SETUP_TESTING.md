# Setup de Testing para IMSA GT7

## 1. Instalar dependencias

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

## 2. Configurar Jest

### jest.config.js

```javascript
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapping: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    "^@/components/(.*)$": "<rootDir>/components/$1",
    "^@/pages/(.*)$": "<rootDir>/pages/$1",
  },
  testEnvironment: "jest-environment-jsdom",
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
```

### jest.setup.js

```javascript
import "@testing-library/jest-dom";

// Mock Firebase
jest.mock("./src/app/api/firebase/firebaseConfig", () => ({
  auth: {},
  db: {},
}));

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    route: "/",
    pathname: "/",
    query: {},
    asPath: "/",
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));
```

## 3. Scripts en package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## 4. Ejemplos de tests para tu proyecto

### **tests**/Dashboard.test.js

```javascript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Dashboard from "../src/app/components/Dashboard";
import { AuthProvider } from "../src/app/context/AuthContext";

// Mock del servicio Firebase
jest.mock("../src/app/services/firebaseService", () => ({
  getTeams: jest.fn(() => Promise.resolve([])),
  getTracks: jest.fn(() => Promise.resolve([])),
  getEvents: jest.fn(() => Promise.resolve([])),
}));

const MockedAuthProvider = ({ children }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("Dashboard Component", () => {
  test("renders loading state initially", () => {
    render(
      <MockedAuthProvider>
        <Dashboard />
      </MockedAuthProvider>
    );

    expect(screen.getByText("Cargando campeonato...")).toBeInTheDocument();
  });

  test("renders navigation buttons", async () => {
    render(
      <MockedAuthProvider>
        <Dashboard />
      </MockedAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("🏎️ Equipos")).toBeInTheDocument();
      expect(screen.getByText("👤 Pilotos")).toBeInTheDocument();
      expect(screen.getByText("🏁 Pistas")).toBeInTheDocument();
      expect(screen.getByText("🎉 Eventos")).toBeInTheDocument();
    });
  });

  test("switches between views when navigation buttons are clicked", async () => {
    render(
      <MockedAuthProvider>
        <Dashboard />
      </MockedAuthProvider>
    );

    await waitFor(() => {
      const driversButton = screen.getByText("👤 Pilotos");
      fireEvent.click(driversButton);
      expect(
        screen.getByText("👤 Clasificación de Pilotos")
      ).toBeInTheDocument();
    });
  });

  test("calculates driver total points correctly", async () => {
    // Test para la función calculateDriverTotal
    // Necesitarías exportar esta función o testearla indirectamente
  });
});
```

### **tests**/AuthContext.test.js

```javascript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../src/app/context/AuthContext";

// Mock Firebase Auth
const mockSignInWithEmailAndPassword = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();

jest.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: (...args) =>
    mockSignInWithEmailAndPassword(...args),
  signOut: (...args) => mockSignOut(...args),
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

// Componente de prueba que usa el contexto
const TestComponent = () => {
  const { currentUser, login, logout, isAdmin } = useAuth();

  return (
    <div>
      <span data-testid="user-status">
        {currentUser ? `Logged in: ${currentUser.email}` : "Not logged in"}
      </span>
      <span data-testid="admin-status">
        {isAdmin() ? "Is Admin" : "Not Admin"}
      </span>
      <button onClick={() => login("test@test.com", "password")}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe("AuthContext", () => {
  test("provides authentication context", () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId("user-status")).toHaveTextContent(
      "Not logged in"
    );
    expect(screen.getByTestId("admin-status")).toHaveTextContent("Not Admin");
  });

  test("handles login correctly", async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { email: "test@test.com" },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText("Login"));

    await waitFor(() => {
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(), // auth object
        "test@test.com",
        "password"
      );
    });
  });

  test("identifies admin users correctly", () => {
    const adminUser = { email: "serranogt7@gmail.com" };

    // Mock auth state change to return admin user
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(adminUser);
      return () => {}; // unsubscribe function
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId("admin-status")).toHaveTextContent("Is Admin");
  });
});
```

### **tests**/utils.test.js

```javascript
// Tests para funciones utilitarias que podrías extraer del Dashboard

describe("Utility Functions", () => {
  describe("calculateDriverTotal", () => {
    test("calculates total from object points", () => {
      const points = {
        track1: 10,
        track2: 15,
        track3: 8,
      };

      // Necesitarías exportar esta función
      // expect(calculateDriverTotal(points)).toBe(33)
    });

    test("calculates total from array points", () => {
      const points = [10, 15, 8, 0, 12];

      // expect(calculateDriverTotal(points)).toBe(45)
    });

    test("returns 0 for invalid points", () => {
      // expect(calculateDriverTotal(null)).toBe(0)
      // expect(calculateDriverTotal(undefined)).toBe(0)
      // expect(calculateDriverTotal('invalid')).toBe(0)
    });
  });

  describe("getTrackStatus", () => {
    test("returns correct status for different dates", () => {
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // expect(getTrackStatus(today)).toBe('today')
      // expect(getTrackStatus(tomorrow)).toBe('upcoming')
      // expect(getTrackStatus(yesterday)).toBe('completed')
    });
  });
});
```

## 5. Coverage Goals

Objetivo de cobertura para la entrevista:

- **Statements**: >80%
- **Branches**: >75%
- **Functions**: >85%
- **Lines**: >80%

## 6. Comandos para ejecutar

```bash
# Correr todos los tests
npm test

# Correr tests en modo watch
npm run test:watch

# Generar reporte de cobertura
npm run test:coverage
```
