# ZIP-0 — Arquitectura del Payment Bridge Multi-EVM & Stellar (Circle USDC + Pollar)

## 1. Visión General: Abstracción EVM-First & Stellar Pollar

El proyecto **ZIP-0** es una infraestructura de interoperabilidad y pagos cross-chain en **USDC** diseñada para conectar el ecosistema **Stellar (Pollar SDK)** con redes **Multi-EVM (Avalanche Fuji, HSK, Arbitrum)** bajo una experiencia sin fricciones de gas:

> **Principio de Diseño:**
>
> - **Comercios y dApps en EVM**: Operan de forma nativa con sus wallets estándar (MetaMask, Core, Rabby). Reciben y liquidan pagos en **Circle USDC nativo** sin lidiar con claves de Stellar, endpoints de Horizon ni enrutamientos manuales de CCTP.
> - **Usuarios y Pagadores en Stellar**: Pagan a través de **Pollar SDK** (red Stellar) disfrutando de transacciones **sin gas de XLM**, donde las comisiones de red y reservas base son absorbidas por el modelo de patrocinio de Pollar.
> - **Relayer Orchestrator ZIP-0**: Escucha los eventos on-chain bidireccionalmente, coordina las firmas autorizadas y liquida los fondos instantáneamente en la red de destino.

---

## 2. Redes Soportadas y Despliegue Oficial en Testnet

| Red | Chain ID | Rol en ZIP-0 | Estado |
| :--- | :--- | :--- | :--- |
| **Avalanche Fuji Testnet** | `43113` | Destino y Origen EVM Principal (Cochabamba Bounty) | **Activo & Desplegado** |
| **Stellar Testnet** | — | Origen y Destino Stellar (Pollar SDK / Horizon) | **Activo & Conectado** |
| **HashKey Chain (HSK) Testnet** | `133` | Despliegue EVM Simétrico | Listo para desplegar |
| **Hardhat Local** | `31337` | Pruebas locales y CI/CD offline | Soportado (`pnpm node:local`) |

### Direcciones de Protocolo en Avalanche Fuji (`43113`)

| Recurso / Rol | Dirección en Avalanche Fuji | Enlace SnowTrace |
| :--- | :--- | :--- |
| **`ZIP0PaymentVault`** | `0xF1ca5572DC03f84aB0f2e5806df336264375e1Fa` | [Ver Contrato](https://testnet.snowtrace.io/address/0xF1ca5572DC03f84aB0f2e5806df336264375e1Fa) |
| **Circle USDC (Fuji)** | `0x5425890298aed601595a70ab815c96711a31bc65` | [Ver Token](https://testnet.snowtrace.io/address/0x5425890298aed601595a70ab815c96711a31bc65) |
| **Relayer Authorized Signer** | `0xAB659E7197bB3c399E9a295261F1D4557D4A714B` | [Ver Wallet](https://testnet.snowtrace.io/address/0xAB659E7197bB3c399E9a295261F1D4557D4A714B) |

### Parámetros de Stellar Testnet (Pollar)

- **Horizon URL**: `https://horizon-testnet.stellar.org`
- **Circle USDC Issuer (Stellar Testnet)**: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- **Pollar App ID**: `cmty35mez000v0iobxbgcitxt`

---

## 3. Dinámica de Fondos y Abstracción de Gas

### Modelo de Patrocinio en Stellar (Pollar)

Pollar implementa **Fee-Bump Transactions** y **Sponsored Reserves**:

1. **Gas Sponsorship**: Pollar patrocina el fee de red de Stellar en cada transacción. El usuario final **no gasta XLM**.
2. **Reserve Sponsorship**: Pollar patrocina la reserva mínima de cuenta (1 XLM) y la creación de trustlines (0.5 XLM por activo).

### Dinámica de Saldo USDC

- **Para Enviar Pagos (Stellar ➔ EVM)**: El pagador debe poseer saldo en USDC en Stellar y la trustline activa del emisor de Circle. El patrocinio cubre el gas de red, pero no el principal del pago.
- **Para Recibir Pagos (EVM ➔ Stellar)**: El receptor en Stellar no requiere saldo previo. La cuenta se aprovisiona con la trustline de USDC patrocinada automáticamente (`sponsor_trustlines: true`).

---

## 4. Arquitectura de Flujos Bidireccionales

### Flujo 1: Stellar (Pollar SDK) ➔ Red EVM (Comercio / Recipient)

```text
[ Pagador (Stellar / Pollar) ]     [ Stellar Horizon ]          [ Relayer Orchestrator ]       [ ZIP0PaymentVault (EVM) ]      [ Comercio en EVM ]
             │                             │                               │                                │                              │
             │── 1. Pago USDC vía Pollar ─>│                               │                                │                              │
             │   (Transacción sin gas XLM) │── 2. Confirmación Ledger ────>│                                │                              │
             │                             │                               │── 3. releasePayment(...) ─────>│                              │
             │                             │                               │      (Relayer paga gas EVM)    │── 4. Transferencia USDC ────>│
             │                             │                               │                                │      (Circle USDC nativo)    │
```

1. **Invocación del Pago**: El pagador autoriza el monto en USDC desde su cuenta de Pollar.
2. **Detección**: El Relayer detecta el pago confirmado en el ledger de Stellar con el identificador único del pago.
3. **Liberación con Gas Abstracted**: El Relayer invoca `releasePayment(paymentId, recipient, amount)` en el contrato `ZIP0PaymentVault` en la red EVM de destino.
4. **Liquidación**: El contrato transfiere Circle USDC nativo al comercio de forma instantánea.

---

### Flujo 2: Red EVM (Pagador) ➔ Stellar (Receptor / Pollar)

```text
[ Pagador en EVM ]              [ ZIP0PaymentVault (EVM) ]      [ Relayer Orchestrator ]         [ Stellar Horizon ]          [ Receptor en Stellar ]
        │                                │                               │                                │                              │
        │── 1. depositPayment(USDC) ────>│                               │                                │                              │
        │   (Destino: G-Address Stellar) │── 2. Emite PaymentInitiated ─>│                                │                              │
        │                                │                               │── 3. Settlement on-chain ─────>│                              │
        │                                │                               │      (Vía Pollar client)       │── 4. USDC acreditado ───────>│
```

1. **Depósito en Vault**: El usuario en EVM deposita USDC en el Vault indicando la dirección de Stellar (`bytes32 destinationRecipient`).
2. **Evento On-Chain**: El contrato bloquea el USDC y emite el evento `PaymentInitiated`.
3. **Liquidación en Stellar**: El Relayer detecta el evento y ejecuta el crédito on-chain en Stellar vía Pollar hacia la dirección de destino.

---

## 5. Pruebas de Ejecución On-Chain (Testnet en Vivo)

La arquitectura fue validada de extremo a extremo en redes públicas de prueba:

- **Liquidación Stellar ➔ Avalanche Fuji**:
  - Transacción Stellar: [`1377e7b1c2b16fc7b37a4a9efca10228ef702240c527d02afc837e57b9617ad2`](https://stellar.expert/explorer/testnet/tx/1377e7b1c2b16fc7b37a4a9efca10228ef702240c527d02afc837e57b9617ad2)
  - Transacción Avalanche Fuji: [`0x70da84e4b58078e49c715b839b4fb862fb3f8ebf07087f8f55cc56bb97aaa671`](https://testnet.snowtrace.io/tx/0x70da84e4b58078e49c715b839b4fb862fb3f8ebf07087f8f55cc56bb97aaa671)

- **Liquidación Avalanche Fuji ➔ Stellar**:
  - Depósito Avalanche Fuji: [`0x21bccb9857fa83b4353d10a6e4e9e4c21da4ee269a20137b683b2576cb582be0`](https://testnet.snowtrace.io/tx/0x21bccb9857fa83b4353d10a6e4e9e4c21da4ee269a20137b683b2576cb582be0)
  - Liquidación Stellar: [`399300addb872228ae3464171a7138745fc253dd14b4013cfce5fbf5657b11c3`](https://stellar.expert/explorer/testnet/tx/399300addb872228ae3464171a7138745fc253dd14b4013cfce5fbf5657b11c3)

---

## 6. Comandos de Desarrollo y Operación

Todos los comandos del monorepo se ejecutan mediante **`pnpm`**:

| Comando | Función |
| :--- | :--- |
| `pnpm test:payment` | Ejecuta el runner de prueba cruzada entre Stellar Testnet y Avalanche Fuji |
| `pnpm -r test` | Ejecuta todos los tests unitarios con Vitest y Hardhat |
| `pnpm lint` | Chequea la sintaxis y estilo de código con ESLint |
| `pnpm node:local` | Levanta un nodo local de Hardhat con `MockUSDC` |
| `pnpm deploy:local` | Despliega los contratos en el entorno local |

---

## 7. Próximos Pasos de Implementación

1. **Integración Frontend de Cuentas Pollar**:
   - Integrar login social (Google, Email OTP o Passkeys de WebAuthn) mediante `@pollar/react` en la aplicación cliente.
   - Conectar la sesión autenticada de Pollar con el formulario de checkout donde el destinatario sea cualquier dirección EVM (Avalanche Fuji / HSK).
2. **Agente de Pago Autónomo / Cron Job Relayer**:
   - Desarrollar un servicio daemon persistente (Node.js/TypeScript) o Cron Job que monitoree continuamente los eventos `PaymentInitiated` en EVM y las transacciones de Pollar en Stellar Horizon.
   - Implementar reintentos con backoff exponencial y registro estructurado para garantizar que ninguna transacción quede sin liquidar si hay congestión de red.

---

## 8. Mejoras de Arquitectura y Componentes Faltantes

1. **Pipeline de Rebalanceo Automático vía Circle CCTP V2 (Iris Attestation)**:
   - El contrato `ZIP0PaymentVault.sol` implementa la función `rebalanceVault(...)`.
   - Conectar el cliente Iris de CCTP (`packages/cctp-bridge/src/adapters/cctp/`) para que, cuando el saldo de liquidez del Vault descienda de un umbral operativo mínimo, se dispare un bridge automático de Circle quemando y minteando USDC nativo desde otras redes EVM (Arbitrum, Base o Ethereum).
2. **Persistencia e Indexación en Base de Datos**:
   - Implementar una base de datos ligera (SQLite/PostgreSQL) para registrar el histórico y ciclo de vida de los pagos (`PENDING`, `RELAYED`, `CONFIRMED`, `FAILED`), acelerando las consultas de estado desde la interfaz de usuario sin saturar los RPCs de blockchain.
3. **SDK de Checkout para Desarrolladores Externos (`@zip-0/sdk`)**:
   - Empaquetar el cliente en una librería modular lista para ser consumida por dApps externas con un componente de pago embebido.
