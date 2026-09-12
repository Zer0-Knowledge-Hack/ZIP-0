# ZIP-0 — Arquitectura de Infraestructura de Pagos Institucionales Cross-Border (Circle USDC + Pollar)

> **Este documento describe la arquitectura OBJETIVO, no el estado actual del código.**
>
> Varios componentes descritos aquí — el riel CCTP, el `PaymentRoutingEngine`, el SDK y el API
> Gateway — están diseñados pero **no implementados**. Para saber exactamente qué existe hoy,
> consultá [`docs/project-status.md`](../docs/project-status.md), que fue verificado ejecutando el
> código y consultando redes en vivo.
>
> Los parámetros de red y direcciones de HashKey Chain verificados están en
> [`docs/hsk-chain-integration.md`](../docs/hsk-chain-integration.md).

## 1. Visión General: Rieles de Liquidación Institucional (Reemplazo SWIFT)

El proyecto **ZIP-0** es una infraestructura de ingeniería de pagos cross-border y liquidación en **Circle USDC** diseñada para instituciones financieras, gobiernos, ONGs y fintechs globales (e.g. transferencias directas hacia centros financieros como Singapur, Europa o Latinoamérica sin intermediarios bancarios tradicionales ni SWIFT).

### Principios de Ingeniería de Software (Clean Architecture / Ports & Adapters)

1. **Núcleo Agnóstico del Proveedor (Decoupled Core)**: El motor de pagos (`PaymentRoutingEngine`) opera bajo el patrón de **Ports & Adapters (Hexagonal Architecture)**. No depende de wallets específicas ni de si la red subyacente implementa CCTP nativo o requiere un pool de liquidez.
2. **Abstracción Total de Gas (Zero Native Gas Friction)**: Ninguna institución maneja tokens volátiles de red (POL, AVAX, ETH). Todo el fondeo y autorización se realiza directamente en **Circle USDC** mediante **ERC-3009 (`transferWithAuthorization`)**, EIP-712 o patrocinio de gas vía Paymasters.
3. **Consumo Simplificado (API Gateway + SDK)**: Las entidades se integran mediante un **REST API Gateway** y el paquete **`@zip-0/sdk`**, delegando toda la complejidad de orquestación, verificación on-chain y liquidación a la infraestructura de ZIP-0.

---

## 2. Matriz de Rieles de Liquidación (Dual-Rail Strategy)

El motor evalúa automáticamente la ruta de pago y selecciona el riel óptimo mediante el patrón **Strategy**:

```text
                               ┌─────────────────────────────┐
                               │    PaymentRoutingEngine     │
                               │   (Intención de Pago USDC)   │
                               └──────────────┬──────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
      ┌───────────────────────────────┐               ┌───────────────────────────────┐
      │      CctpSettlementRail       │               │      VaultSettlementRail      │
      │    (Burn & Mint 1:1 Nativo)   │               │   (Liquidity Vault + Float)   │
      └───────────────┬───────────────┘               └───────────────┬───────────────┘
                      │                                               │
             [ Redes con CCTP ]                              [ Redes sin CCTP ]
       Polygon PoS, Avalanche Fuji,                      HashKey Chain (HSK),
       Arbitrum, Base, Ethereum                          Testbeds Locales
      (Tickets: $1M - $50M+ / Sin Pools)              (Tickets Minoristas / Pools Propios)
```

### Comparativa de Rieles

| Característica | CCTP Settlement Rail (Circle Oficial) | Vault Settlement Rail (ZIP0PaymentVault) |
| :--- | :--- | :--- |
| **Mecanismo On-Chain** | Quema en origen y acuñación en destino 1:1 (*Iris Attestation*) | Bloqueo en Vault origen y liberación en Vault destino vía Relayer |
| **Capacidad de Liquidez** | **Infinita (Sin Pools)**. Apta para pagos institucionales ($1M - $50M+) | **Limitada al Float disponible** en el contrato `ZIP0PaymentVault` |
| **Slippage y Riesgo** | 0% Slippage. Cero riesgo de contraparte de pools privados | Requiere rebalanceo y monitorización de liquidez del Vault |
| **Redes Soportadas** | **Polygon PoS**, **Avalanche**, **Arbitrum**, **Base**, **Ethereum** | **HashKey Chain** (Testnet `133` / Mainnet `177`), Hardhat Local (`31337`) |
| **Tipo de USDC** | USDC nativo de Circle | Avalanche: USDC nativo · HashKey Chain: **USDC.e bridged** (`0x054ed4…8D0a`, 6 decimales) |

---

## 3. Estrategia de Cuentas y Abstracción de Red (Pollar & Stellar)

### A. Pollar sobre Cuentas EVM (Polygon)

- **Implementación Actual**: Para evitar fricciones de custodia y proveer una experiencia institucional inmediata, se utiliza **Pollar conectado a cuentas de Polygon (EVM)**.
- **Ventaja**: Permite acceso directo e inmediato a la infraestructura nativa de CCTP en Polygon sin salir del ecosistema EVM.

### B. Estado de Stellar y Hoja de Ruta CCTP

- **Situación Técnica**: En la red Stellar, Circle emite USDC nativo mediante trustlines clásicas, pero **Circle CCTP no está desplegado on-chain** (no existen contratos `TokenMessenger` en Soroban/Stellar actualmente).
- **Decisión de Arquitectura**:
  - El soporte de pagos entre Stellar y EVM mediante el Relayer y Vault actual se mantiene documentado como corredor puente especializado.
  - Se registra formalmente el **Issue / Milestone en el Roadmap**: `feat: stellar-native-cctp-adapter` para incorporar Stellar al `CctpSettlementRail` apenas Circle publique CCTP en Soroban.

---

## 4. Abstracción de Gas y Autorizaciones Institucionales

Las instituciones financieras no adquieren tokens nativos de red para comisiones. ZIP-0 implementa dos mecanismos de abstracción:

```text
[ Institución / CFO ] ─── 1. Firma EIP-712 (transferWithAuthorization) ───> [ API Gateway ZIP-0 ]
      (Sin Gas)                                                                     │
                                                                                    │── 2. Envía Tx y paga Gas
                                                                                    ▼
                                                                        [ Circle USDC Contract ]
```

1. **Circle ERC-3009 (`transferWithAuthorization`)**:
   - La institución firma una autorización criptográfica off-chain con validez temporal (`validBefore`, `validAfter`) y nonce anti-replay.
   - El Relayer/Paymaster de ZIP-0 presenta la autorización y asume el gas nativo en la red correspondiente.
2. **Fee Sponsorship de Pollar**:
   - Para flujos basados en cuentas Pollar, el patrocinio de comisiones absorbe los costos de transacción de red.

---

## 5. Arquitectura de Interfaces (Core Domain)

> ⚠️ **Estado: DISEÑO PROPUESTO, no implementado.** Las interfaces de abajo (`ISettlementRail`,
> `IPaymentRouter`, `PaymentIntent.railType`) todavía no existen en el código. El archivo real
> `packages/cctp-bridge/src/core/interfaces.ts` define hoy `IEvmAdapter`, `IStellarAdapter` e
> `IRelayerOrchestrator`, y `PaymentIntent` no tiene campo `railType`. Esta sección es el destino
> del refactor descrito en la Fase 1 de la hoja de ruta.

```typescript
// packages/cctp-bridge/src/core/interfaces.ts — OBJETIVO (aún no implementado)

export type SettlementRailType = 'CCTP_BURN_MINT' | 'LIQUIDITY_VAULT';

export interface PaymentIntent {
  readonly id: `0x${string}`;
  readonly sourceChainId: number;
  readonly destinationChainId: number;
  readonly sender: `0x${string}`;
  readonly recipient: `0x${string}`;
  readonly amount: bigint; // 6 decimales USDC
  readonly railType: SettlementRailType;
  readonly status: 'PENDING' | 'ROUTING' | 'SETTLING' | 'CONFIRMED' | 'FAILED';
  readonly createdAt: number;
}

export interface ISettlementRail {
  readonly railType: SettlementRailType;
  supportsRoute(sourceChainId: number, destinationChainId: number): boolean;
  estimateFee(sourceChainId: number, destinationChainId: number, amount: bigint): Promise<bigint>;
  executeSettlement(intent: PaymentIntent, authorizationSignature?: `0x${string}`): Promise<`0x${string}`>;
}

export interface IPaymentRouter {
  routePayment(intent: Omit<PaymentIntent, 'status' | 'createdAt' | 'railType'>): Promise<PaymentIntent>;
  getPaymentStatus(paymentId: `0x${string}`): Promise<PaymentIntent>;
}
```

---

## 6. Superficie de Consumo: API Gateway y SDK (`@zip-0/sdk`)

> ⚠️ **Estado: DISEÑO PROPUESTO, no implementado.** Ni el paquete `@zip-0/sdk` ni los endpoints
> REST existen todavía. Corresponden a la Fase 4 de la hoja de ruta.

Las instituciones interactuarán con ZIP-0 a través de interfaces de alto nivel:

### A. Endpoints REST API

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/v1/payments/quote` | Obtiene cotización de ruta, tiempo estimado y selección de riel (CCTP vs. Vault) |
| `POST` | `/v1/payments/transfer` | Inicia una orden de pago institucional adjuntando firma ERC-3009 o débito |
| `GET` | `/v1/payments/:id` | Consulta el estado de liquidación y hashes on-chain |
| `POST` | `/v1/webhooks` | Suscripción de webhooks para eventos `payment.settled`, `payment.failed` |

### B. Consumo Programático vía `@zip-0/sdk`

```typescript
import { Zip0Client } from '@zip-0/sdk';

const zip0 = new Zip0Client({ apiKey: process.env.ZIP0_API_KEY });

// Transferencia interbancaria instantánea Polygon -> Avalanche vía CCTP
const payment = await zip0.payments.create({
  amount: '5000000.00', // 5,000,000 USDC
  sourceChain: 'polygon',
  destinationChain: 'avalanche',
  recipient: '0xSingaporeBankSettlement...',
  reference: 'INV-2026-SG-001',
});

console.log(`Payment status: ${payment.status}, Rail: ${payment.railType}`);
```

---

## 7. Redes Desplegadas y Parámetros Operativos

| Red | Chain ID | Rol en ZIP-0 | Riel Principal | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **Polygon PoS** | `137` / `80002` | Hub Institucional & Pollar EVM | **CCTP Rail** | Configurado |
| **Avalanche Fuji** | `43113` | Hub EVM Principal (Cochabamba Bounty) | **CCTP Rail / Vault** | **Desplegado y Activo** |
| **HashKey Chain Testnet** | `133` | Riel EVM Simétrico | **Vault Rail** | Red activa — listo para desplegar |
| **HashKey Chain Mainnet** | `177` | Riel EVM Simétrico | **Vault Rail** | Red activa — listo para desplegar |
| **Stellar Testnet** | — | Corredor Pollar clásico | **Bridge Adapter** | Activo (Issue abierto para CCTP) |
| **Hardhat Local** | `31337` | CI/CD y Pruebas Unitarias | **Vault Rail** | Soportado (`pnpm node:local`) |

### Direcciones de Referencia en Avalanche Fuji (`43113`)

- **`ZIP0PaymentVault`**: `0xF1ca5572DC03f84aB0f2e5806df336264375e1Fa`
- **Circle USDC (Fuji)**: `0x5425890298aed601595a70ab815c96711a31bc65`
- **Relayer Signer**: `0xAB659E7197bB3c399E9a295261F1D4557D4A714B`

---

## 8. Hoja de Ruta de Implementación (Roadmap)

1. **Fase 1: Abstracción de Interfaces del Core**:
   - Refactorizar `packages/cctp-bridge/src/core/` con `ISettlementRail` y `PaymentRoutingEngine`.
2. **Fase 2: Implementación de Riel CCTP (Polygon & Avalanche)**:
   - Integrar contratos de Circle `TokenMessenger` y verificación Iris en `CctpSettlementRail`.
3. **Fase 3: Módulo de Abstracción de Gas ERC-3009**:
   - Implementar el generador y validador de firmas `transferWithAuthorization` para flujos gasless.
4. **Fase 4: Empaquetado de `@zip-0/sdk` y API Gateway**:
   - Desarrollar la capa de endpoints REST y exportar el cliente institucional tipado.
5. **Fase 5: Issue de Soporte Nativo CCTP en Stellar**:
   - Monitorear e integrar el estándar CCTP cuando Circle publique el emisor en Soroban.
