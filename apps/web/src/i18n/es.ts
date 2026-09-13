export const es = {
  navigation: "Navegación principal",
  menu: "Abrir opciones",
  language: "Idioma",
  home: "Inicio",
  pay: "Pagar",
  demo: "Demostración",
  demoCard: "Vista de ejemplo de una orden de pago ZIP-0",
  demoNote: "Vista de ejemplo. No representa una operación real.",
  business: "PARA EMPRESAS",
  overview: "Resumen",
  newPayment: "Nuevo pago",
  activity: "Mis pagos",
  help: "Ayuda",
  workspace: "Espacio de trabajo",
  company: "Tu empresa",
  test: "Entorno de prueba",
  connect: "Conectar wallet",
  disconnect: "Desconectar",
  greeting: "Resumen de tu cuenta",
  subtitle: "Gestiona los pagos de tu empresa.",
  intro: "Pagos internacionales",
  hero: "Pago a proveedores",
  heroBody:
    "Prepara el monto en USDC, los datos del destinatario y la referencia de tu factura.",
  start: "Preparar un pago",
  available: "Tu saldo disponible",
  liquidity: "Liquidez del servicio",
  pending: "Seguimiento de pagos",
  currency: "USDC",
  noWallet: "Consulta de red pendiente de integrar",
  noData: "Sin datos consultados",
  quick: "Cómo preparar tu pago",
  quickBody:
    "Necesitas la dirección del destinatario y la referencia de la operación.",
  step1: "Prepara",
  step1Body: "Indica el monto, el destinatario y tu factura.",
  step2: "Revisa",
  step2Body: "Comprueba los detalles antes de autorizar.",
  step3: "Sigue",
  step3Body: "Consulta el estado y el comprobante del depósito.",
  recent: "Últimos movimientos",
  recentBody: "Consulta tus operaciones y su estado.",
  empty: "Historial pendiente de conexión",
  emptyBody:
    "Todavía no hemos consultado tus pagos. La conexión al historial de la red estará disponible en la siguiente etapa.",
  viewAll: "Ver mis pagos",
  trust: "Sobre la liquidación",
  trustBody:
    "La liquidación depende de un operador autorizado. Un depósito confirmado no demuestra que el proveedor ya recibió el pago.",
  support: "¿Primera vez en ZIP-0?",
  supportBody: "Conoce cómo funciona tu pago.",
  guide: "Ver guía",
  footer: "Infraestructura para conectar negocios.",
  formTitle: "Nuevo pago",
  formBody: "Prepara los datos de tu pago internacional.",
  amount: "Monto a enviar",
  recipient: "Dirección del destinatario en Stellar",
  reference: "Referencia de factura o DUI",
  optional: "opcional",
  hs: "Código arancelario HS",
  document: "Documento de respaldo",
  upload: "Seleccionar PDF",
  documentHint:
    "El archivo permanece en tu equipo. Calculamos únicamente su huella digital.",
  review: "Revisar datos",
  back: "Volver",
  route: "Ruta del pago",
  source: "Origen",
  destination: "Destino",
  summary: "Resumen de tu pago",
  draft: "Borrador · No enviado",
  reviewHint:
    "Revisa tu borrador. El envío y la firma de pagos se conectarán en la siguiente etapa.",
  edit: "Editar datos",
  invalid:
    "Ingresa un monto positivo con hasta 6 decimales y completa el destinatario y la referencia.",
  pdfError: "Elige un PDF de hasta 10 MB.",
  walletMissing: "Necesitas una wallet de navegador compatible, como MetaMask.",
  walletError:
    "No se pudo conectar la wallet. Revisa la solicitud en tu extensión.",
  tech: "Ver detalle técnico",
  hash: "Huella digital del documento",
  local: "Hardhat local",
  theme: "Cambiar apariencia",
  beta: "Vista previa",
  previewNote:
    "Vista previa de la aplicación. Puedes preparar un borrador; todavía no se envían pagos.",
  helpTitle: "Tu pago, paso a paso",
  helpBody:
    "ZIP-0 conecta empresas mediante infraestructura de pagos en USDC. Esta primera versión permite explorar la aplicación y preparar un borrador.",
  helpWallet: "Tu wallet",
  helpWalletBody:
    "La conexión solicita tu dirección pública. Nunca te pedimos claves privadas ni frases de recuperación.",
  helpNetwork: "Redes de prueba",
  helpNetworkBody:
    "El selector elige el contexto de la aplicación. No cambia automáticamente la red de tu wallet.",
  helpSettlement: "Depósito y liquidación",
  helpSettlementBody:
    "Depositar en un vault y pagar al destinatario son pasos distintos. La aplicación debe mostrar cada confirmación por separado.",
  referencePlaceholder: "Ej. INV-2026-001",
  recipientPlaceholder: "G…",
  hsPlaceholder: "Ej. 3102.10",
  network: "Red",
  clear: "Quitar documento",

  // --- Landing ---
  landing: "Inicio",
  landingEyebrow: "Infraestructura de liquidación cross-border",
  landingTitle: "Pagos internacionales en USDC, liquidados en segundos",
  landingLead:
    "ZIP-0 mueve valor entre cadenas y corredores sin banca corresponsal. La liquidación ocurre on-chain y es verificable por cualquiera.",
  landingCta: "Abrir la aplicación",
  landingCtaSecondary: "Ver el contrato",

  landingProblemTitle: "El problema",
  landingProblemBody:
    "SWIFT transporta mensajes, no dinero. La liquidación real depende de una cadena de bancos corresponsales: tarda días, cobra comisiones en cada salto y nadie ve dónde está el pago mientras viaja.",

  landingHowTitle: "Cómo funciona",
  landingRail1: "Riel CCTP",
  landingRail1Body:
    "Quema en origen y acuñación en destino, 1:1, sin pool de liquidez ni slippage. Para corredores donde Circle tiene CCTP desplegado.",
  landingRail1Status: "Diseñado, no implementado",
  landingRail2: "Riel de vault",
  landingRail2Body:
    "Bloqueo en el vault de origen y liberación desde el float en destino. Cubre corredores sin CCTP, como HashKey Chain y Stellar.",
  landingRail2Status: "Operativo",

  landingProofTitle: "Verificable, no prometido",
  landingProofBody:
    "El vault está desplegado y su estado se puede consultar sin pedirnos permiso. Estas son las direcciones reales:",
  landingProofVault: "Vault de pagos",
  landingProofNetwork: "Red",

  landingPrototype: "Prototipo en red de prueba",
  landingPrototypeBody:
    "ZIP-0 no tiene licencia, no custodia fondos de clientes y no procesa valor real. Los contratos no están auditados y la liquidación depende hoy de un relayer confiable.",
  landingLegal: "Ver divulgación completa",
};
export type Messages = Record<keyof typeof es, string>;
