# Define un invariante de seguridad — ZIP0PaymentVault

> **Quest:** *Define un invariante de seguridad* (Ethereum Bolivia Buildathon).
> **Contrato:** `ZIP0PaymentVault` — `packages/contracts-evm/contracts/ZIP0PaymentVault.sol`.
> **Redes:** HSK Testnet (133) y Avalanche Fuji (43113).
> **Tipo de ejercicio:** razonamiento formal / modelado. No incluye cambios de código.

---

## Paso 1 — Contrato elegido

`ZIP0PaymentVault` es el contrato de escrow de ZIP-0 para pagos cross-border en USDC. Recibe
depósitos (`depositPayment`, `depositWithPermit`, `depositWithAuthorization`) y liquida por dos
vías:

- **Liberación:** `releasePayment` (solo `RELAYER_ROLE`) envía USDC a un destinatario en la cadena
  destino.
- **Reembolso:** `refundPayment` (relayer) o `claimRefund` (el propio pagador, tras
  `REFUND_TIMEOUT = 24 hours` sin haber sido acreditado).

Cada depósito guarda un `paymentId` único con un `amount` y un estado en la máquina
`NONE → INITIATED → {ACKNOWLEDGED, RELEASED, REFUNDED}`.

---

## Paso 2 — Invariante de seguridad

> **Invariante de liquidación única.**
> Un mismo depósito no puede liquidarse dos veces: si se acredita en la cadena destino, no puede
> además reembolsarse en origen.
>
> Formalmente, para todo `paymentId`:
>
> `acreditadoEnDestino(p)  ⇒  ¬reembolsadoEnOrigen(p)`

El crédito en destino ocurre **fuera de la cadena** (Stellar/Pollar o CCTP), así que el contrato no
puede observarlo directamente. Por eso garantiza el invariante mediante un **proxy verificable
on-chain**:

> `estado[p] == ACKNOWLEDGED  ⇒  claimRefund(p) revierte siempre`

Es decir: en cuanto el relayer declara on-chain que tomó el depósito
(`acknowledgePayment`: `INITIATED → ACKNOWLEDGED`), el pagador pierde la vía de auto-reembolso y
solo el relayer puede reembolsarlo. Así el sistema puede liquidar **exactamente una vez**.

---

## Paso 3 — Escenario de fallo

Secuencia que rompería el invariante:

1. El pagador deposita **100 USDC** con `paymentId = P` → estado `INITIATED`; el vault custodia los
   100 USDC.
2. El relayer **acredita el destino** (llama a `creditPayment` en Stellar/Pollar para `P`) pero
   **no llama** `acknowledgePayment(P)`. El depósito queda en `INITIATED`.
3. Pasan las 24 horas de `REFUND_TIMEOUT`.
4. El pagador llama `claimRefund(P)`: `estado == INITIATED` ✓, `msg.sender == payer` ✓,
   `block.timestamp >= timestamp + REFUND_TIMEOUT` ✓ → el vault le devuelve 100 USDC y marca
   `REFUNDED`.
5. Resultado: el pagador cobró **el crédito en destino y el reembolso**. El vault paga dos veces y
   drena su flotante. Invariante roto.

La causa raíz no es un error de Solidity, sino **una omisión de orden en el relayer**: acredita sin
declarar antes el depósito on-chain. Esto es exactamente lo que cierra el issue **#26**
(*"acknowledge vault deposits before settling on Stellar"*).

---

## Paso 4 — Mitigación

**Regla de proceso (la que cierra el hueco):**
el relayer debe llamar `acknowledgePayment(P)` **antes** de acreditar el destino. Con el depósito en
`ACKNOWLEDGED`, `claimRefund` revierte y la única salida es `refundPayment` (relayer), de modo que
solo puede haber un desenlace.

**Garantías dentro del contrato:**

- `_createPayment` exige `estado == NONE` → un `paymentId` no se puede depositar dos veces.
- `claimRefund` exige `estado == INITIATED` → un depósito reconocido o ya liquidado no admite
  auto-reembolso.
- `refundPayment` acepta `INITIATED` o `ACKNOWLEDGED` y escribe un estado terminal.
- Los estados terminales (`RELEASED`, `REFUNDED`) son inmutables.
- Las funciones que transfieren fondos usan `nonReentrant`, así que una reentrada no puede duplicar
  el pago.

**Trade-off honesto (liveness):** si el relayer hace `acknowledge` y luego falla el crédito, el
pagador ya no puede auto-reembolsarse; depende de que el relayer llame `refundPayment`. Ese es el
motivo por el que la regla de proceso debe ir acompañada de la lógica de relayer de #26.

**Límite de confianza (por qué es un proxy y no una prueba):** el contrato no puede probar que el
crédito en destino ocurrió. Confía en que el relayer haga `acknowledge` únicamente cuando vaya a
liquidar. Es la misma suposición de *"relayer honesto"* que ZIP-0 ya documenta; el camino hacia la
liquidación sin confianza es el riel CCTP.

---

## Paso 5 — Presentación al staff

**Guion de 60 segundos:**

1. "Elegimos `ZIP0PaymentVault`, el escrow de pagos cross-border de ZIP-0."
2. "El invariante es **liquidación única**: un depósito no puede acreditarse en destino y además
   reembolsarse en origen."
3. "El fallo: el relayer acredita el destino pero **no** llama `acknowledgePayment`; a las 24 h el
   pagador se auto-reembolsa y cobra dos veces."
4. "La mitigación: `acknowledge` **antes** de acreditar. Con el estado `ACKNOWLEDGED`, `claimRefund`
   revierte y solo el relayer puede reembolsar."
5. "El contrato garantiza la parte on-chain; la coordinación del relayer la cierra el issue #26.
   No es 'blockchain infalible', es un razonamiento preciso sobre qué garantiza el contrato y qué
   debe garantizar el sistema."

*Al finalizar la presentación, escanear el QR de este quest.*

---

## Anexo — Dónde está en el código

| Concepto | Ubicación |
| :--- | :--- |
| Depósito y estado inicial | `ZIP0PaymentVault._createPayment` (exige `NONE`) |
| Reconocimiento por el relayer | `ZIP0PaymentVault.acknowledgePayment` (`INITIATED → ACKNOWLEDGED`) |
| Auto-reembolso del pagador | `ZIP0PaymentVault.claimRefund` (exige `INITIATED`) |
| Reembolso por el relayer | `ZIP0PaymentVault.refundPayment` (`INITIATED` o `ACKNOWLEDGED`) |
| Anti-reentrada | modificador `nonReentrant` en las funciones que transfieren fondos |
| Trabajo de relayer relacionado | issue **#26** — *acknowledge vault deposits before settling on Stellar* |

---

## Guion corto para presentar (40 segundos)

> "Elegimos nuestro contrato de pagos, `ZIP0PaymentVault`. La regla que siempre debe cumplirse es:
> **un depósito no puede pagarse dos veces**. Si el dinero se entrega en el destino, no puede además
> devolverse en origen.
>
> El fallo sería este: el relayer entrega el dinero en el otro lado, pero **olvida avisarle al
> contrato**. A las 24 horas, el pagador pide su devolución y cobra dos veces — se rompe la regla.
>
> La solución es simple: el relayer debe avisarle al contrato **'ya tomé este pago' antes** de
> entregar el dinero. Con ese aviso, el pagador ya no puede auto-devolverse; solo el relayer puede
> devolver si algo falla. Así se paga una sola vez.
>
> En resumen: el contrato garantiza su parte, y el orden del relayer cierra el hueco."

Al terminar: **escanear el QR del quest.**

**En una frase, si preguntan:** "Es un candado: el dinero solo puede salir una vez, y el contrato
obliga al relayer a marcar el pago antes de pagar."
