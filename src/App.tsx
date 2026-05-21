import React, { useState, useEffect } from "react";
import {
  Shield,
  Activity,
  Bell,
  Users,
  Calendar as CalendarIcon,
  TrendingUp,
  Plus,
  Download,
  Upload,
  Trash2,
  Printer,
  Eye,
  Settings,
  Share2,
  Check,
  Clock,
  AlertTriangle,
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  Building,
  Database,
  RefreshCw,
  FileSpreadsheet,
  X,
  CreditCard,
  MessageSquare,
  Menu
} from "lucide-react";
import { Cliente, Pago, Contacto, ReciboPersonalizado, EmpresaData, ServicioPredefinido } from "./types";
import {
  FREQ_LABELS,
  fmtDate,
  todayStr,
  diffDays,
  montoFinal,
  addPeriodo,
  periodoCubierto,
  parseCSVRows,
  normalizeImportDate,
  normalizeMoney
} from "./utils/helpers";
import { ReceiptTicket } from "./components/ReceiptTicket";
import { CustomReceiptsTab } from "./components/CustomReceiptsTab";
import { ApiClient } from "./utils/apiClient";

export default function App() {
  // Authentication & Session States
  const [isAuthenticated, setIsAuthenticated] = useState(() => ApiClient.isAuthenticated());
  const [loginTenantId, setLoginTenantId] = useState(() => localStorage.getItem("remembered_tenant_id") || "");
  const [loginUsername, setLoginUsername] = useState(() => localStorage.getItem("remembered_username") || "");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [userMetadata, setUserMetadata] = useState(() => ApiClient.getSessionMetadata());

  // Tabs and State
  const [activeTab, setActiveTab] = useState<"dashboard" | "pendientes" | "clientes" | "calendario" | "recibos" | "ingresos">("dashboard");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [recibos, setRecibos] = useState<ReciboPersonalizado[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaData>({
    nombre: "Detektor Seguridad Profesional",
    rfc: "DET123456XX0",
    dir: "Periférico de la Juventud #4400, Chihuahua",
    logo: ""
  });
  const [serviciosCatalogo, setServiciosCatalogo] = useState<ServicioPredefinido[]>([]);
  const [dbStatus, setDbStatus] = useState<{ mode: "dynamo" | "local"; error: string | null; fallbackFile: string }>({
    mode: "local",
    error: null,
    fallbackFile: ""
  });
  
  // Loading & Sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [fontSize, setFontSize] = useState(15);

  // Search & Filtering States
  const [spSearch, setSpSearch] = useState("");
  const [spFilter, setSpFilter] = useState("");
  const [scSearch, setScSearch] = useState("");
  const [scFilter, setScFilter] = useState("");
  
  // Sorting States
  const [sortClientes, setSortClientes] = useState<{ col: keyof Cliente | "montoFinal"; asc: boolean }>({ col: "nombre", asc: true });
  const [sortPend, setSortPend] = useState<{ col: keyof Cliente | "montoFinal"; asc: boolean }>({ col: "proximoCobro", asc: true });

  // Pagination
  const [pageClientes, setPageClientes] = useState(1);
  const [pagePend, setPagePend] = useState(1);
  const PAGE_SIZE = 12;

  // Calendar State
  const [calM, setCalM] = useState(new Date().getMonth());
  const [calY, setCalY] = useState(new Date().getFullYear());

  // Report Date Range State
  const [repDesde, setRepDesde] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [repHasta, setRepHasta] = useState(todayStr);
  const [repSearch, setRepSearch] = useState("");
  const [repType, setRepType] = useState<"todos" | "suscripciones" | "recibos">("todos");

  // Modal States
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configModalTab, setConfigModalTab] = useState<"empresa" | "db">("empresa");
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeReceiptClient, setActiveReceiptClient] = useState<Cliente | null>(null);
  const [activeReceiptSelectedFecha, setActiveReceiptSelectedFecha] = useState("");
  const [activeCustomReceipt, setActiveCustomReceipt] = useState<ReciboPersonalizado | null>(null);

  // Custom confirmation modal states (replaces window.confirm)
  const [paymentToConfirm, setPaymentToConfirm] = useState<Cliente | null>(null);
  const [confirmMetodoPago, setConfirmMetodoPago] = useState<string>("Transferencia");
  const [clientToDelete, setClientToDelete] = useState<Cliente | null>(null);
  const [backupRestoreData, setBackupRestoreData] = useState<any | null>(null);

  // Database Connection Fields inside settings
  const [supaUrl, setSupaUrl] = useState(() => localStorage.getItem("sec_supa_url") || "");
  const [supaKey, setSupaKey] = useState(() => localStorage.getItem("sec_supa_key") || "");
  const [awsTestStatus, setAwsTestStatus] = useState<{ success: boolean; msg: string } | null>(null);

  // New Client Form States
  const [fId, setFId] = useState("");
  const [fCuenta, setFCuenta] = useState("");
  const [fEstado, setFEstado] = useState<"activo" | "suspendido" | "cancelado">("activo");
  const [fNombre, setFNombre] = useState("");
  const [fTel, setFTel] = useState("");
  const [fContactoNombre, setFContactoNombre] = useState("");
  const [fContactoCel, setFContactoCel] = useState("");
  const [fContactos, setFContactos] = useState<Contacto[]>([]);
  const [fEmail, setFEmail] = useState("");
  const [fRfc, setFRfc] = useState("");
  const [fDir, setFDir] = useState("");
  const [fServicio, setFServicio] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fFreq, setFFreq] = useState<"mensual" | "trimestral" | "semestral" | "anual">("mensual");
  const [fMonto, setFMonto] = useState<number>(0);
  const [fDescuento, setFDescuento] = useState<number>(0);
  const [fInicio, setFInicio] = useState("");
  const [fProx, setFProx] = useState("");
  const [fNotas, setFNotas] = useState("");

  // New Catalog Service Form States
  const [fcNombre, setFcNombre] = useState("");
  const [fcDesc, setFcDesc] = useState("");
  const [fcFreq, setFcFreq] = useState<"mensual" | "trimestral" | "semestral" | "anual">("mensual");
  const [fcMonto, setFcMonto] = useState<number>(0);

  // Pre-load data from API
  const loadAllData = async () => {
    setIsSyncing(true);
    try {
      const authHeaders = ApiClient.getAuthHeaders();

      // 1. Fetch system operational status
      const statusRes = await fetch("/api/status", { headers: authHeaders });
      if (statusRes.ok) {
        const status = await statusRes.json();
        setDbStatus(status);
      }

      // 2. Fetch Clientes
      const clientsRes = await fetch("/api/clientes", { headers: authHeaders });
      if (clientsRes.ok) {
        const list = await clientsRes.json();
        setClientes(list);
      }

      // 3. Fetch Receipts
      const receiptsRes = await fetch("/api/recibos", { headers: authHeaders });
      if (receiptsRes.ok) {
        const rcps = await receiptsRes.json();
        setRecibos(rcps);
      }

      // 4. Fetch Empresa Configuration
      const empRes = await fetch("/api/config?key=empresa", { headers: authHeaders });
      if (empRes.ok) {
        const data = await empRes.json();
        if (data.value) setEmpresa(data.value);
      }

      // 5. Fetch Services Catalog
      const catRes = await fetch("/api/config?key=servicios", { headers: authHeaders });
      if (catRes.ok) {
        const data = await catRes.json();
        if (data.value && Array.isArray(data.value)) {
          setServiciosCatalogo(data.value);
        }
      }
    } catch (e) {
      console.error("Error connecting to Detektor API Node Server:", e);
      triggerToast("⚠ Error en conexión de servidor API");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
    }
  }, [isAuthenticated]);

  // Auth Submit Handlers
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const result = await ApiClient.login(loginTenantId, loginUsername, loginPassword);
      
      // Helper to map and sanitize fields (supports both flat/nested, pascalCase and camelCase keys from AWS STS return payload)
      const sanitize = (val: any) => {
        if (!val) return "";
        const s = String(val).trim();
        if (s === "undefined" || s === "null" || s === "") return "";
        return s;
      };

      const extractField = (path: string): string => {
        const cap = path.charAt(0).toUpperCase() + path.slice(1);
        if ((result as any)[path] !== undefined) return sanitize((result as any)[path]);
        if ((result as any)[cap] !== undefined) return sanitize((result as any)[cap]);

        const nestedProps = ["credentials", "Credentials", "awsCredentials", "AwsCredentials"];
        for (const parent of nestedProps) {
          const parentObj = (result as any)[parent];
          if (parentObj && typeof parentObj === "object") {
            if (parentObj[path] !== undefined) return sanitize(parentObj[path]);
            if (parentObj[cap] !== undefined) return sanitize(parentObj[cap]);
          }
        }
        return "";
      };

      const jwt = sanitize(result.jwt || (result as any).Jwt || (result as any).token || (result as any).Token);
      const tenantApiKey = sanitize(result.tenantApiKey || (result as any).TenantApiKey);
      const name = sanitize(result.name || (result as any).Name) || "Usuario";
      const role = sanitize(result.role || (result as any).Role) || "Operador";
      const userId = sanitize(result.userId || (result as any).UserId);
      const accessKeyId = extractField("accessKeyId");
      const secretAccessKey = extractField("secretAccessKey");
      const sessionToken = extractField("sessionToken");

      // Save returning session variables in localStorage
      localStorage.setItem("detektor_jwt", jwt);
      localStorage.setItem("detektor_tenant_api_key", tenantApiKey);
      localStorage.setItem("detektor_name", name);
      localStorage.setItem("detektor_role", role);
      localStorage.setItem("detektor_user_id", userId);
      localStorage.setItem("detektor_aws_access_key_id", accessKeyId);
      localStorage.setItem("detektor_aws_secret_access_key", secretAccessKey);
      localStorage.setItem("detektor_aws_session_token", sessionToken);
      localStorage.setItem("detektor_tenant_id", loginTenantId);
      localStorage.setItem("remembered_tenant_id", loginTenantId);
      localStorage.setItem("remembered_username", loginUsername);

      setIsAuthenticated(true);
      setUserMetadata({
        name: name,
        role: role,
        tenantId: loginTenantId,
        userId: userId
      });
      triggerToast(`✓ Bienvenido ${name}!`);

      // Trigger automatic DB setup on target AWS credential account
      const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
        "X-Tenant-Id": loginTenantId,
        "X-AWS-Access-Key-Id": accessKeyId,
        "X-AWS-Secret-Access-Key": secretAccessKey,
        "X-AWS-Session-Token": sessionToken
      };
      await fetch("/api/setup", {
        method: "POST",
        headers: authHeaders
      });

    } catch (err: any) {
      setLoginError(err.message || "Error al autenticar con el servidor de AWS.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    ApiClient.logout();
    setIsAuthenticated(false);
    setUserMetadata({ name: "Usuario", role: "Operador", tenantId: "", userId: "" });
    setClientes([]);
    setRecibos([]);
    triggerToast("✓ Sesión terminada.");
  };

  // Show self-destruct popup toast message
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Adjust global fonts dynamically
  const changeFontSize = (delta: number) => {
    setFontSize((prev) => Math.min(22, Math.max(13, prev + delta)));
  };

  // Save Config to Server API
  const saveConfigToServer = async (key: string, value: any) => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: ApiClient.getAuthHeaders(),
        body: JSON.stringify({ key, value })
      });
      return res.ok;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // Save Cliente to Server API
  const saveClienteToServer = async (c: Cliente) => {
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: ApiClient.getAuthHeaders(),
        body: JSON.stringify(c)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  // Delete Cliente on Server API
  const deleteClienteFromServer = async (id: string) => {
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: "DELETE",
        headers: ApiClient.getAuthHeaders()
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  // Database Testing on external configurations (if the user tests Supabase or other cloud integration)
  const handleTestDatabase = async () => {
    if (!supaUrl || !supaKey) {
      setAwsTestStatus({ success: false, msg: "Por favor, ingresa los datos de conexión correspondientes." });
      return;
    }
    setAwsTestStatus({ success: true, msg: "Conectado. Realizando verificación de tablas de base de datos..." });
    try {
      const headers = { "Content-Type": "application/json", "apikey": supaKey, "Authorization": "Bearer " + supaKey };
      const configCheck = await fetch(`${supaUrl}/rest/v1/config?select=key`, { headers });
      if (configCheck.ok) {
        setAwsTestStatus({ success: true, msg: "¡Verificación exitosa! Conectado con la base de datos externa de forma correcta." });
        localStorage.setItem("sec_supa_url", supaUrl);
        localStorage.setItem("sec_supa_key", supaKey);
      } else {
        setAwsTestStatus({ success: false, msg: `Error de autenticación con la base de datos (Estado ${configCheck.status})` });
      }
    } catch (e: any) {
      setAwsTestStatus({ success: false, msg: `Excepción: ${e.message || "Servidor inalcanzable"}` });
    }
  };

  // Navigate to Pendientes Tab and force-sorting to next payment date
  const navigateToPendientes = () => {
    setSortPend({ col: "proximoCobro", asc: true });
    setPagePend(1);
    setActiveTab("pendientes");
  };

  // Register a Quick Payment (Registrar Cobro)
  const handleRegisterPayment = (clienteId: string) => {
    const c = clientes.find((x) => x.id === clienteId);
    if (!c) return;
    setPaymentToConfirm(c);
    setConfirmMetodoPago("Transferencia");
  };

  const handleConfirmPayment = async (c: Cliente, metodoPago: string) => {
    const finalAmount = montoFinal(c);
    const fechaPago = todayStr();
    const pDesde = c.proximoCobro || fechaPago;
    const infoPeriodo = periodoCubierto(pDesde, c.freq);
    const siguienteCobro = addPeriodo(pDesde, c.freq);

    const numRec = "REC-" + String(Date.now()).slice(-6);

    const nuevoPago: Pago = {
      fecha: fechaPago,
      monto: finalAmount,
      recibo: numRec,
      periodoDesde: infoPeriodo.desde,
      periodoHasta: infoPeriodo.hasta,
      metodoPago: metodoPago
    };

    const updatedClient: Cliente = {
      ...c,
      proximoCobro: siguienteCobro,
      pagos: [...(c.pagos || []), nuevoPago]
    };

    // Update state locally
    setClientes((prev) => prev.map((x) => (x.id === c.id ? updatedClient : x)));
    
    // Save to Database via express server
    const ok = await saveClienteToServer(updatedClient);
    if (ok) {
      triggerToast(`✓ Cobro registrado con éxito (${metodoPago}). Ticket: ${numRec}`);
      // Open printer preview immediately
      setActiveReceiptClient(updatedClient);
      setActiveReceiptSelectedFecha(fechaPago);
      setActiveCustomReceipt(null);
      setIsReceiptModalOpen(true);
    } else {
      triggerToast("⚠ Cobro guardado temporalmente en local.");
    }
    setPaymentToConfirm(null);
  };

  const handleDeleteClientConfirmed = async () => {
    if (!clientToDelete) return;
    setClientes((prev) => prev.filter((x) => x.id !== clientToDelete.id));
    setIsClientModalOpen(false);
    
    const ok = await deleteClienteFromServer(clientToDelete.id);
    if (ok) triggerToast("✓ Registro eliminado de base de datos");
    setClientToDelete(null);
  };

  const handleConfirmBackupRestore = async () => {
    if (!backupRestoreData) return;
    setClientes(backupRestoreData.clientes);
    if (backupRestoreData.recibos) setRecibos(backupRestoreData.recibos);
    if (backupRestoreData.empresa) setEmpresa(backupRestoreData.empresa);
    if (backupRestoreData.serviciosCatalogo) setServiciosCatalogo(backupRestoreData.serviciosCatalogo);

    // Upload everything to Node Express DB (loop write)
    for (const item of backupRestoreData.clientes) {
      await saveClienteToServer(item);
    }
    await saveConfigToServer("empresa", backupRestoreData.empresa || empresa);
    await saveConfigToServer("servicios", backupRestoreData.serviciosCatalogo || serviciosCatalogo);

    triggerToast("✓ Base de datos restaurada correctamente");
    setIsConfigModalOpen(false);
    setBackupRestoreData(null);
  };

  // Catalog service selector change autocompletes form
  const handleLoadServiceFromCatalog = (idx: number) => {
    const s = serviciosCatalogo[idx];
    if (!s) return;
    setFServicio(s.nombre);
    setFDesc(s.desc);
    setFFreq(s.freq);
    setFMonto(s.monto);
    setFDescuento(0);
    // Auto-update next payment date
    const baseDate = fInicio || todayStr();
    setFProx(addPeriodo(baseDate, s.freq));
  };

  // Manage Catalog Submissions
  const handleAddServiceToCatalog = async () => {
    if (!fcNombre.trim()) {
      triggerToast("⚠ Especifica el nombre del servicio");
      return;
    }
    if (fcMonto <= 0) {
      triggerToast("⚠ Especifica un importe mayor a cero");
      return;
    }

    const updated = [...serviciosCatalogo, { nombre: fcNombre, desc: fcDesc, freq: fcFreq, monto: fcMonto }];
    setServiciosCatalogo(updated);
    
    const ok = await saveConfigToServer("servicios", updated);
    if (ok) {
      triggerToast("✓ Servicio agregado al catálogo");
      setFcNombre("");
      setFcDesc("");
      setFcMonto(0);
    } else {
      triggerToast("⚠ Error al persistir catálogo");
    }
  };

  const handleRemoveServiceFromCatalog = async (idx: number) => {
    const updated = serviciosCatalogo.filter((_, i) => i !== idx);
    setServiciosCatalogo(updated);
    const ok = await saveConfigToServer("servicios", updated);
    if (ok) triggerToast("✓ Servicio eliminado del catálogo");
  };

  // Send WhatsApp Reminder for overdue bills
  const handleSendWhatsAppNotification = (c: Cliente) => {
    let tel = (c.contactoCel || c.tel || "").replace(/\D/g, "");
    if (!tel) {
      triggerToast("⚠ No hay celular registrado para WhatsApp");
      return;
    }
    if (tel.length === 10) tel = "52" + tel; // default Mexico country code
    
    const overdue = diffDays(c.proximoCobro) < 0;
    const finalAmount = montoFinal(c).toLocaleString("es-MX", { minimumFractionDigits: 2 });
    const clientGreeting = c.contactoNombre || c.nombre;

    let msg = "";
    if (overdue) {
      const days = Math.abs(diffDays(c.proximoCobro));
      msg = `Hola ${clientGreeting}, le enviamos un atento recordatorio de que su pago de $${finalAmount} MXN por el servicio de ${c.servicio || "Monitoreo"} se encuentra vencido desde el día ${fmtDate(c.proximoCobro)} (hace ${days} días). Agradecemos de antemano su apoyo para regularizar su cuenta. Quedamos a su servicio.`;
    } else {
      msg = `Hola ${clientGreeting}, le recordamos cordialmente que su próximo pago por el servicio de ${c.servicio || "Monitoreo"} con importe de $${finalAmount} MXN vence el día ${fmtDate(c.proximoCobro)}. Agradecemos su preferencia.`;
    }

    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Helper to format raw Base64 logo to Data URI safely
  const getLogoSrc = (logo?: string): string => {
    if (!logo) return "";
    const trimmed = logo.trim();
    if (
      trimmed.startsWith("data:") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/")
    ) {
      return trimmed;
    }
    return `data:image/png;base64,${trimmed}`;
  };

  // Helper to convert OKLCH values to RGB/RGBA string formats that html2canvas supports
  const oklchToRgb = (l: number, c: number, hDeg: number, alphaStr?: string): string => {
    const h = (hDeg * Math.PI) / 180;
    const a = c * Math.cos(h);
    const b = c * Math.sin(h);

    const l_l = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_l = l - 0.1055613458 * a - 0.0638541728 * b;
    const s_l = l - 0.0894841775 * a - 1.2914855480 * b;

    const l3 = l_l * l_l * l_l;
    const m3 = m_l * m_l * m_l;
    const s3 = s_l * s_l * s_l;

    const r_lin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    const g_lin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    const b_lin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

    const gamma = (val: number) => {
      const v = val < 0 ? 0 : val > 1 ? 1 : val;
      return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    };

    const r = Math.round(gamma(r_lin) * 255);
    const g = Math.round(gamma(g_lin) * 255);
    const bVal = Math.round(gamma(b_lin) * 255);

    let alpha = 1;
    if (alphaStr) {
      const trimmed = alphaStr.trim();
      if (trimmed.endsWith("%")) {
        alpha = parseFloat(trimmed) / 100;
      } else {
        alpha = parseFloat(trimmed);
      }
    }

    if (alpha === 1) {
      return `rgb(${r}, ${g}, ${bVal})`;
    } else {
      return `rgba(${r}, ${g}, ${bVal}, ${alpha})`;
    }
  };

  const replaceOklchInString = (str: string): string => {
    if (!str || typeof str !== "string") return str;
    if (!str.toLowerCase().includes("oklch")) return str;

    const oklchRegex = /oklch\s*\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*[\/]\s*([\d.%]+))?\s*\)/gi;
    return str.replace(oklchRegex, (match, l, c, h, a) => {
      try {
        return oklchToRgb(parseFloat(l), parseFloat(c), parseFloat(h), a);
      } catch {
        return "rgb(120, 120, 120)";
      }
    });
  };

  // Sharing PDF on WhatsApp or other media
  const handleShareReceiptOnWhatsApp = async () => {
    const targetElement = document.getElementById("receipt-ticket-print-panel");
    if (!targetElement) return;

    triggerToast("Generando comprobante digital PDF...");
    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) {
      triggerToast("⚠ Error: Librería html2pdf no cargada en el navegador");
      return;
    }

    // Temporary monkey-patch on window.getComputedStyle, CSSStyleSheet, and CSSGroupingRule prototype to strip out 'oklch' color functions.
    // html2canvas parses stylesheet rules and throws an error if it encounters modern colors (oklch) introduced in Tailwind v4.
    const originalGetComputedStyle = window.getComputedStyle;
    const originalCssRules = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "cssRules");
    const originalRules = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "rules");
    const originalGroupingRules = typeof CSSGroupingRule !== "undefined" ? Object.getOwnPropertyDescriptor(CSSGroupingRule.prototype, "cssRules") : null;
    const originalKeyframesRules = typeof CSSKeyframesRule !== "undefined" ? Object.getOwnPropertyDescriptor(CSSKeyframesRule.prototype, "cssRules") : null;

    const filterRules = (rules: any) => {
      if (!rules) return rules;
      try {
        const filtered = Array.from(rules).filter((rule: any) => {
          const text = rule.cssText || "";
          return !text.includes("oklch") && !text.includes("OKLCH");
        });
        (filtered as any).item = (idx: number) => filtered[idx];
        return filtered as any;
      } catch (e) {
        return rules;
      }
    };

    try {
      window.getComputedStyle = function (el, pseudoElt) {
        const style = originalGetComputedStyle.call(window, el, pseudoElt);
        return new Proxy(style, {
          get(target, prop, receiver) {
            if (prop === "getPropertyValue") {
              return function (propertyName: string) {
                const val = target.getPropertyValue(propertyName);
                return replaceOklchInString(val);
              };
            }
            const val = Reflect.get(target, prop, target);
            if (typeof val === "function") {
              return val.bind(target);
            }
            if (typeof val === "string") {
              return replaceOklchInString(val);
            }
            return val;
          }
        });
      };

      Object.defineProperty(CSSStyleSheet.prototype, "cssRules", {
        get() {
          try {
            const rules = originalCssRules?.get?.call(this);
            return filterRules(rules);
          } catch (e) {
            return [];
          }
        },
        configurable: true,
      });

      if (originalRules) {
        Object.defineProperty(CSSStyleSheet.prototype, "rules", {
          get() {
            try {
              const rules = originalRules?.get?.call(this);
              return filterRules(rules);
            } catch (e) {
              return [];
            }
          },
          configurable: true,
        });
      }

      if (originalGroupingRules) {
        Object.defineProperty(CSSGroupingRule.prototype, "cssRules", {
          get() {
            try {
              const rules = originalGroupingRules.get?.call(this);
              return filterRules(rules);
            } catch (e) {
              return [];
            }
          },
          configurable: true,
        });
      }

      if (originalKeyframesRules) {
        Object.defineProperty(CSSKeyframesRule.prototype, "cssRules", {
          get() {
            try {
              const rules = originalKeyframesRules.get?.call(this);
              return filterRules(rules);
            } catch (e) {
              return [];
            }
          },
          configurable: true,
        });
      }
    } catch (patchErr) {
      console.warn("Could not patch isheets for oklch support", patchErr);
    }

    try {
      const filename = activeCustomReceipt
        ? `Recibo_${activeCustomReceipt.numeroRecibo}.pdf`
        : activeReceiptClient
        ? `Recibo_${activeReceiptClient.cuenta}.pdf`
        : "Recibo_Detektor.pdf";

      const pdfBlob = await html2pdf()
        .set({
          margin: [6, 6, 6, 6],
          filename: filename,
          html2canvas: { scale: 2.5, useCORS: true, logging: false },
          jsPDF: { unit: "mm", format: "letter", orientation: "portrait" }
        })
        .from(targetElement)
        .outputPdf("blob");

      // Restore original cssRules properties immediately after html2pdf finishes
      try {
        window.getComputedStyle = originalGetComputedStyle;
        if (originalCssRules) {
          Object.defineProperty(CSSStyleSheet.prototype, "cssRules", originalCssRules);
        } else {
          delete (CSSStyleSheet.prototype as any).cssRules;
        }
        if (originalRules) {
          Object.defineProperty(CSSStyleSheet.prototype, "rules", originalRules);
        } else {
          delete (CSSStyleSheet.prototype as any).rules;
        }
        if (originalGroupingRules && typeof CSSGroupingRule !== "undefined") {
          Object.defineProperty(CSSGroupingRule.prototype, "cssRules", originalGroupingRules);
        }
        if (originalKeyframesRules && typeof CSSKeyframesRule !== "undefined") {
          Object.defineProperty(CSSKeyframesRule.prototype, "cssRules", originalKeyframesRules);
        }
      } catch (restoreErr) {
        console.warn("Could not restore rules getters", restoreErr);
      }

      // Verify Web share API availability
      const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (!esIOS && navigator.share && navigator.canShare) {
        const file = new File([pdfBlob], filename, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Recibo de Pago Detektor",
            text: "Adjuntamos su comprobante de pago oficial."
          });
          triggerToast("✓ Recibo compartido exitosamente.");
          return;
        }
      }

      // Download Fallback
      const url = URL.createObjectURL(pdfBlob);
      const tempLink = document.createElement("a");
      tempLink.href = url;
      tempLink.download = filename;
      tempLink.click();
      triggerToast("✓ Recibo descargado como PDF.");

      // Open WA Chat link
      const clientObject = activeCustomReceipt || activeReceiptClient;
      if (clientObject) {
        const telInput = (clientObject as any).clienteTel || (clientObject as any).tel || (clientObject as any).contactoCel || "";
        let finalTel = telInput.replace(/\D/g, "");
        if (finalTel.length === 10) finalTel = "52" + finalTel;
        if (finalTel) {
          setTimeout(() => {
            window.open(`https://wa.me/${finalTel}?text=${encodeURIComponent("Hola, le envío su comprobante de pago PDF en el archivo adjunto.")}`, "_blank");
          }, 1500);
        }
      }
    } catch (e) {
      console.error(e);
      triggerToast("⚠ Error al generar o compartir PDF.");
    } finally {
      // Ensure getters are restored even if generation throws an error
      try {
        window.getComputedStyle = originalGetComputedStyle;
        if (originalCssRules) {
          Object.defineProperty(CSSStyleSheet.prototype, "cssRules", originalCssRules);
        } else {
          delete (CSSStyleSheet.prototype as any).cssRules;
        }
        if (originalRules) {
          Object.defineProperty(CSSStyleSheet.prototype, "rules", originalRules);
        } else {
          delete (CSSStyleSheet.prototype as any).rules;
        }
        if (originalGroupingRules && typeof CSSGroupingRule !== "undefined") {
          Object.defineProperty(CSSGroupingRule.prototype, "cssRules", originalGroupingRules);
        }
        if (originalKeyframesRules && typeof CSSKeyframesRule !== "undefined") {
          Object.defineProperty(CSSKeyframesRule.prototype, "cssRules", originalKeyframesRules);
        }
      } catch (restoreErr) {
        // quiet fail
      }
    }
  };

  // Trigger Silent Frame Print on the Receipt Modal
  const handlePrintSilentTicket = () => {
    const rawHtml = document.getElementById("receipt-ticket-print-panel")?.innerHTML;
    if (!rawHtml) return;

    // Clean up any stale iframe from previous attempts to reset caching/handlers
    const existingIframe = document.getElementById("print-iframe");
    if (existingIframe) {
      existingIframe.remove();
    }

    // Create a pristine, dedicated iframe
    const iframe = document.createElement("iframe");
    iframe.id = "print-iframe";
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "75mm"; // Match ticket physical size
    iframe.style.height = "100px";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Impresión de Ticket Detektor</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Courier New', monospace; font-size: 13px; color: #000; padding: 0; }
            .ticket-body { width: 75mm; padding: 0 4px; box-sizing: border-box; }
            .ticket-body img { max-width: 100%; height: auto; filter: grayscale(100%) contrast(140%); }
            .ticket-body table { width: 100%; border-collapse: collapse; }
            .ticket-body td, .ticket-body th { padding: 4px 0; border: none; font-size: 13px; }
            .ticket-divider-dashed { border-top: 1.5px dashed #000; margin: 8px 0; height: 0; }
            .ticket-divider-dotted { border-top: 1.5px dotted #000; margin: 6px 0; height: 0; }
            @media print {
              @page { size: 75mm auto; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="ticket-body">
            \${rawHtml}
          </div>
          <script>
            function triggerPrint() {
              try {
                window.focus();
                window.print();
              } catch (e) {
                console.error("Subframe self-print failed:", e);
              }
            }
            if (document.readyState === "complete" || document.readyState === "interactive") {
              setTimeout(triggerPrint, 150);
            } else {
              window.onload = function() {
                setTimeout(triggerPrint, 150);
              };
            }
          </script>
        </body>
      </html>
    `);
    doc.close();

    // Dual-trigger fallback: Also call print from the parent window context with focus transfer
    setTimeout(() => {
      try {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
      } catch (error) {
        console.warn("Parent-driven fallback print skipped due to sandbox constraints.", error);
      }
    }, 300);
  };

  // Client Editor modal submission and sync
  const handleOpenClientEditor = (c: Cliente | null) => {
    setEditingClient(c);
    if (!c) {
      // New Client Base Fields
      setFId("");
      setFCuenta("SEC-" + String(Number(clientes.length ? Math.max(...clientes.map(x => Number(x.cuenta.replace(/\D/g, "")))) : 1000) + 1));
      setFEstado("activo");
      setFNombre("");
      setFTel("");
      setFContactoNombre("");
      setFContactoCel("");
      setFContactos([]);
      setFEmail("");
      setFRfc("");
      setFDir("");
      setFServicio("");
      setFDesc("");
      setFFreq("mensual");
      setFMonto(0);
      setFDescuento(0);
      setFInicio(todayStr());
      setFProx(todayStr());
      setFNotas("");
    } else {
      // Load current fields
      setFId(c.id);
      setFCuenta(c.cuenta);
      setFEstado(c.estado || "activo");
      setFNombre(c.nombre);
      setFTel(c.tel || "");
      setFContactoNombre(c.contactoNombre || "");
      setFContactoCel(c.contactoCel || "");
      
      const existingContactos = c.contactos && c.contactos.length > 0
        ? c.contactos
        : (c.contactoNombre || c.contactoCel)
          ? [{ nombre: c.contactoNombre || "", cel: c.contactoCel || "" }]
          : [];
      setFContactos(existingContactos);

      setFEmail(c.email || "");
      setFRfc(c.rfc || "");
      setFDir(c.dir || "");
      setFServicio(c.servicio || "");
      setFDesc(c.desc || "");
      setFFreq(c.freq);
      setFMonto(c.monto);
      setFDescuento(c.descuento || 0);
      setFInicio(c.inicio || "");
      setFProx(c.proximoCobro);
      setFNotas(c.notas || "");
    }
    setIsClientModalOpen(true);
  };

  const handleSaveClientModal = async () => {
    if (!fNombre.trim()) {
      alert("El nombre completo del cliente es obligatorio");
      return;
    }
    
    // Validations are only strict if the status is active
    const isActivo = fEstado === "activo";
    
    if (isActivo) {
      if (fMonto <= 0) {
        alert("El importe de servicio debe ser mayor a cero para clientes activos");
        return;
      }
      if (!fProx) {
        alert("Especifica la próxima fecha de cobro para clientes activos");
        return;
      }
    }

    const mainContact = fContactos[0];
    const itemObj: Cliente = {
      id: fId || "cli-" + Date.now(),
      cuenta: fCuenta.trim() || ("SEC-" + (clientes.length + 1001)),
      nombre: fNombre.trim(),
      tel: fTel.trim() || undefined,
      contactoNombre: mainContact ? mainContact.nombre.trim() : (fContactoNombre.trim() || undefined),
      contactoCel: mainContact ? mainContact.cel.trim() : (fContactoCel.trim() || undefined),
      contactos: fContactos,
      email: fEmail.trim() || undefined,
      rfc: fRfc.trim() || undefined,
      dir: fDir.trim() || undefined,
      freq: fFreq,
      monto: Number(fMonto),
      descuento: Number(fDescuento),
      servicio: fServicio.trim() || undefined,
      desc: fDesc.trim() || undefined,
      inicio: fInicio || undefined,
      proximoCobro: fProx || "",
      notas: fNotas.trim() || undefined,
      estado: fEstado,
      pagos: editingClient ? (editingClient.pagos || []) : []
    };

    // Check account redundancy
    const existingNum = clientes.find((x) => x.cuenta.toLowerCase() === itemObj.cuenta.toLowerCase() && x.id !== itemObj.id);
    if (existingNum) {
      alert(`La cuenta "${itemObj.cuenta}" ya está asignada al cliente: ${existingNum.nombre}`);
      return;
    }

    if (editingClient) {
      setClientes((prev) => prev.map((x) => (x.id === editingClient.id ? itemObj : x)));
    } else {
      setClientes((prev) => [...prev, itemObj]);
    }

    setIsClientModalOpen(false);
    const ok = await saveClienteToServer(itemObj);
    if (ok) {
      triggerToast("✓ Cliente guardado en la base de datos.");
    } else {
      triggerToast("⚠ Guardado de forma local (error de sincronización).");
    }
  };

  const handleDeleteClientModal = async () => {
    if (!editingClient) return;
    const confirms = window.confirm(`¿Seguro que deseas eliminar definitivamente a ${editingClient.nombre} (${editingClient.cuenta})?\nTodos sus historiales de pago se borrarán.`);
    if (!confirms) return;

    setClientes((prev) => prev.filter((x) => x.id !== editingClient.id));
    setIsClientModalOpen(false);
    
    const ok = await deleteClienteFromServer(editingClient.id);
    if (ok) triggerToast("✓ Registro eliminado de base de datos");
  };

  // Custom Receipt creation in CustomReceiptsTab
  const handleSaveCustomReceipt = async (r: ReciboPersonalizado) => {
    setRecibos((prev) => [...prev, r]);
    try {
      const res = await fetch("/api/recibos", {
        method: "POST",
        headers: ApiClient.getAuthHeaders(),
        body: JSON.stringify(r)
      });
      if (res.ok) {
        triggerToast("✓ Recibo guardado y emitido con éxito.");
        // Auto open receipt printing ticket
        setActiveCustomReceipt(r);
        setActiveReceiptClient(undefined);
        setIsReceiptModalOpen(true);
      } else {
        triggerToast("⚠ Error al emitir recibo en la base de datos.");
      }
    } catch (e) {
      triggerToast("⚠ Recibo guardado temporalmente en local.");
    }
  };

  const handleDeleteCustomReceipt = async (id: string) => {
    setRecibos((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/recibos/${id}`, { 
        method: "DELETE",
        headers: ApiClient.getAuthHeaders()
      });
      if (res.ok) triggerToast("✓ Recibo eliminado.");
    } catch (e) {
      triggerToast("⚠ Error al sincronizar eliminación con servidor.");
    }
  };

  // Configuration settings form save
  const handleSaveSettingsModal = async () => {
    const ok = await saveConfigToServer("empresa", empresa);
    if (ok) {
      triggerToast("✓ Configuración de la empresa guardada.");
      setIsConfigModalOpen(false);
    } else {
      triggerToast("⚠ Error al sincronizar configuración.");
    }
  };

  // Complete data import from CSV
  const handleImportCSVData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      try {
        const textValue = event.target?.result as string;
        const parsedRows = parseCSVRows(textValue);
        if (parsedRows.length < 2) {
          triggerToast("⚠ El archivo CSV no contiene registros válidos.");
          return;
        }

        const headerRow = parsedRows[0];
        const indexMap: Record<string, number> = {};
        headerRow.forEach((colName, index) => {
          const norm = colName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
          indexMap[norm] = index;
        });

        let importCount = 0;
        const freshClients: Cliente[] = [];

        for (let i = 1; i < parsedRows.length; i++) {
          const rowData = parsedRows[i];
          if (!rowData || rowData.length === 0 || !rowData[0]) continue;

          const cuenta = rowData[indexMap["ncuenta"] || indexMap["nocuenta"] || indexMap["cuenta"] || 0] || "";
          const nombre = rowData[indexMap["nombre"] || indexMap["cliente"] || indexMap["nombrecompleto"] || 1] || "";
          if (!nombre) continue;

          const tel = rowData[indexMap["telefono"] || indexMap["tel"]] || "";
          const email = rowData[indexMap["email"] || indexMap["correo"]] || "";
          const rfc = rowData[indexMap["rfc"] || indexMap["razonsocial"]] || "";
          const dir = rowData[indexMap["direccion"] || indexMap["domicilio"]] || "";
          const servicio = rowData[indexMap["servicio"] || indexMap["tipodeservicio"]] || "";
          const desc = rowData[indexMap["equipo"] || indexMap["descripcion"]] || "";
          const freqRaw = (rowData[indexMap["frecuencia"]] || "mensual").toLowerCase();
          const freq = ["mensual", "trimestral", "semestral", "anual"].includes(freqRaw)
            ? (freqRaw as any)
            : "mensual";

          const monto = normalizeMoney(rowData[indexMap["monto"] || indexMap["precio"]] || "0");
          const dPerc = normalizeMoney(rowData[indexMap["descuento"] || indexMap["descuentopercent"]] || "0");
          const inicio = normalizeImportDate(rowData[indexMap["inicio"] || indexMap["fechainicio"]] || todayStr());
          const proximo = normalizeImportDate(rowData[indexMap["proximocobro"] || indexMap["siguientepago"]] || todayStr());
          const estRaw = (rowData[indexMap["estado"]] || "activo").toLowerCase();
          const estado = ["activo", "suspendido", "cancelado"].includes(estRaw) ? (estRaw as any) : "activo";
          const notas = rowData[indexMap["notas"] || indexMap["observaciones"]] || "";

          const newObj: Cliente = {
            id: "cli-import-" + Date.now() + "-" + i,
            cuenta: cuenta || `SEC-GEN-${i + 200}`,
            nombre,
            tel: tel || undefined,
            email: email || undefined,
            rfc: rfc || undefined,
            dir: dir || undefined,
            servicio: servicio || undefined,
            desc: desc || undefined,
            freq,
            monto,
            descuento: dPerc,
            inicio,
            proximoCobro: proximo,
            estado,
            notas: notas || undefined,
            pagos: []
          };

          freshClients.push(newObj);
          importCount++;
        }

        if (freshClients.length > 0) {
          // Sync all to servers
          for (const cli of freshClients) {
            await saveClienteToServer(cli);
          }
          setClientes((prev) => [...prev, ...freshClients]);
          triggerToast(`✓ ¡Éxito! Se han importado ${importCount} clientes desde el CSV.`);
        }
      } catch (err) {
        console.error(err);
        triggerToast("⚠ Error al parsear o leer archivo CSV");
      }
    };
    fileReader.readAsText(file, "UTF-8");
  };

  // Full database backup in JSON
  const handleExportJSONData = () => {
    const rawBackup = {
      clientes,
      recibos,
      empresa,
      serviciosCatalogo,
      schema: "Global_Payments_Detektor_JSON",
      exportedAt: new Date().toISOString()
    };
    const stringified = JSON.stringify(rawBackup, null, 2);
    const blob = new Blob([stringified], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const tempLink = document.createElement("a");
    tempLink.href = url;
    tempLink.download = `CopiaSeguridad_Detektor_${todayStr()}.json`;
    tempLink.click();
    triggerToast("✓ Respaldo JSON generado y descargado");
  };

  const handleImportJSONData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backup = JSON.parse(text);
        if (!backup || !backup.clientes) {
          triggerToast("⚠ Archivo de restauración inválido");
          return;
        }

        setBackupRestoreData(backup);
      } catch (err) {
        triggerToast("⚠ El archivo está corrupto o mal estructurado.");
      }
    };
    fileReader.readAsText(file, "UTF-8");
  };

  // CSV Export for quick spreadsheets
  const handleExportCSVData = () => {
    const header = "No Cuenta,Nombre,Telefono,Email,RFC,Direccion,Servicio,Equipo,Frecuencia,Monto,Descuento%,ProximoCobro,Estado,Notas\n";
    const bodyStr = clientes
      .map((c) =>
        [
          c.cuenta,
          c.nombre,
          c.tel || "",
          c.email || "",
          c.rfc || "",
          c.dir || "",
          c.servicio || "",
          c.desc || "",
          c.freq,
          c.monto,
          c.descuento,
          c.proximoCobro,
          c.estado,
          c.notas || ""
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + header + bodyStr], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const tempLink = document.createElement("a");
    tempLink.href = url;
    tempLink.download = `Clientes_Detektor_${todayStr()}.csv`;
    tempLink.click();
    triggerToast("✓ Reporte CSV descargado.");
  };

  // Core Calculations and Lists formatting
  const filterClients = (list: Cliente[], search: string, statusFilter: string) => {
    return list.filter((c) => {
      const matchSearch =
        !search ||
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        c.cuenta.toLowerCase().includes(search.toLowerCase()) ||
        (c.tel && c.tel.includes(search)) ||
        (c.servicio && c.servicio.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = !statusFilter || c.estado === statusFilter;
      return matchSearch && matchStatus;
    });
  };

  const getSortedList = <T extends {}>(list: T[], config: { col: keyof T | string; asc: boolean }) => {
    return list.slice().sort((a: any, b: any) => {
      let valA = a[config.col] ?? "";
      let valB = b[config.col] ?? "";

      if (config.col === "montoFinal") {
        valA = montoFinal(a);
        valB = montoFinal(b);
      }

      if (config.col === "proximoCobro") {
        const daysA = diffDays(String(valA));
        const daysB = diffDays(String(valB));
        return config.asc ? daysA - daysB : daysB - daysA;
      }

      if (typeof valA === "number") {
        return config.asc ? valA - valB : valB - valA;
      }
      return config.asc
        ? String(valA).localeCompare(String(valB), "es")
        : String(valB).localeCompare(String(valA), "es");
    });
  };

  // Dashboard calculations
  const activeClients = clientes.filter((x) => x.estado === "activo");
  const overdueClients = activeClients.filter((x) => diffDays(x.proximoCobro) < 0);
  const todayCobros = activeClients.filter((x) => diffDays(x.proximoCobro) === 0);
  const weekCobros = activeClients.filter((x) => {
    const days = diffDays(x.proximoCobro);
    return days >= 0 && days <= 7;
  });
  const monthBillingExpected = activeClients
    .filter((x) => {
      const days = diffDays(x.proximoCobro);
      return days >= 0 && days <= 30;
    })
    .reduce((sum, item) => sum + montoFinal(item), 0);

  // Income dashboard calculations: Consolidated Transactions (Subscriptions + Custom Receipts)
  interface ConsolidatedTransaction {
    id: string;
    type: "suscripcion" | "libre";
    cliId?: string;
    cuenta: string;
    nombre: string;
    servicio: string;
    monto: number;
    fecha: string;
    recibo: string;
    periodoDesde: string;
    periodoHasta: string;
    metodo: string;
    rawRecibo?: ReciboPersonalizado;
  }

  const allPayments: Array<{
    cliId: string;
    cuenta: string;
    nombre: string;
    servicio: string;
    monto: number;
    fecha: string;
    recibo: string;
    periodoDesde: string;
    periodoHasta: string;
    metodo: string;
  }> = [];

  clientes.forEach((c) => {
    (c.pagos || []).forEach((p) => {
      allPayments.push({
        cliId: c.id,
        cuenta: c.cuenta,
        nombre: c.nombre,
        servicio: c.servicio || "Monitoreo",
        monto: Number(p.monto),
        fecha: p.fecha,
        recibo: p.recibo,
        periodoDesde: p.periodoDesde,
        periodoHasta: p.periodoHasta,
        metodo: "Efectivo/Transferencia"
      });
    });
  });

  const allLibres: Array<{
    cliId?: string;
    cuenta: string;
    nombre: string;
    servicio: string;
    monto: number;
    fecha: string;
    recibo: string;
    periodoDesde: string;
    periodoHasta: string;
    metodo: string;
    rawRecibo: ReciboPersonalizado;
  }> = (recibos || []).map((r) => ({
    cliId: r.clienteId,
    cuenta: r.clienteId ? (clientes.find((cli) => cli.id === r.clienteId)?.cuenta || "REC-LIBRE") : "REC-LIBRE",
    nombre: r.clienteNombre,
    servicio: r.items.map((item) => `${item.nombre} (x${item.cantidad})`).join(", ") || "Productos/Servicios",
    monto: Number(r.total),
    fecha: r.fecha,
    recibo: r.numeroRecibo,
    periodoDesde: r.fecha,
    periodoHasta: r.fecha,
    metodo: r.metodoPago,
    rawRecibo: r
  }));

  // Build a complete listing representing both
  const unionTransactions: Array<ConsolidatedTransaction> = [
    ...allPayments.map((p, idx) => ({ ...p, id: `sub-${p.recibo}-${idx}`, type: "suscripcion" as const })),
    ...allLibres.map((p) => ({ ...p, id: `lib-${p.recibo}`, type: "libre" as const }))
  ];

  // Apply filters (Date range, Search, and Type)
  const filteredIncomePayments = unionTransactions.filter((t) => {
    // 1. Date filters
    if (repDesde && t.fecha < repDesde) return false;
    if (repHasta && t.fecha > repHasta) return false;

    // 2. Tab categorization type filter
    if (repType === "suscripciones" && t.type !== "suscripcion") return false;
    if (repType === "recibos" && t.type !== "libre") return false;

    // 3. Search word filter
    if (repSearch.trim()) {
      const q = repSearch.toLowerCase();
      const matchName = t.nombre.toLowerCase().includes(q);
      const matchCuenta = t.cuenta.toLowerCase().includes(q);
      const matchRecibo = t.recibo.toLowerCase().includes(q);
      const matchServicio = t.servicio.toLowerCase().includes(q);
      if (!matchName && !matchCuenta && !matchRecibo && !matchServicio) return false;
    }

    return true;
  });

  // Totals calculations
  const totalCollectedInPeriod = filteredIncomePayments.reduce((sum, t) => sum + t.monto, 0);

  // Subtotals per source for stats
  const totalSuscripcionesInPeriod = filteredIncomePayments
    .filter((t) => t.type === "suscripcion")
    .reduce((sum, t) => sum + t.monto, 0);

  const countSuscripcionesInPeriod = filteredIncomePayments.filter((t) => t.type === "suscripcion").length;

  const totalLibresInPeriod = filteredIncomePayments
    .filter((t) => t.type === "libre")
    .reduce((sum, t) => sum + t.monto, 0);

  const countLibresInPeriod = filteredIncomePayments.filter((t) => t.type === "libre").length;

  // Sorting columns helper symbols
  const getSortArrow = (curr: string, active: string, asc: boolean) => {
    if (curr !== active) return "";
    return asc ? " ↑" : " ↓";
  };

  // Elegant Dark Login Guard Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen text-slate-300 font-sans flex items-center justify-center bg-[#070709] relative p-6 overflow-hidden">
        {/* Ambient glow decoration */}
        <div className="absolute top-[-15%] left-[-15%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[60%] h-[60%] rounded-full bg-indigo-500/5 blur-[130px] pointer-events-none" />

        <div className="w-full max-w-sm p-8 bg-[#0d0d12] border border-white/5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative z-10 transition-all duration-300">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-4 active:scale-95 transition-transform">
              <Shield className="w-6 h-6 animate-pulse" />
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Detektor Cobros</h1>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-1.5 font-mono">Consola de Control</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold flex items-start gap-2 text-left animate-shake">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">ID Compañía (tenantId)</label>
              <input
                type="text"
                required
                placeholder="Ej. mi-empresa-101"
                value={loginTenantId}
                onChange={(e) => setLoginTenantId(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#121217] border border-white/5 focus:border-indigo-500/80 text-sm text-slate-200 placeholder-slate-600 rounded-lg outline-none transition-all focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nombre de Usuario</label>
              <input
                type="text"
                required
                placeholder="Nombre de usuario"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#121217] border border-white/5 focus:border-indigo-500/80 text-sm text-slate-200 placeholder-slate-600 rounded-lg outline-none transition-all focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#121217] border border-white/5 focus:border-indigo-500/80 text-sm text-slate-200 placeholder-slate-600 rounded-lg outline-none transition-all focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white font-medium text-sm rounded-lg transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mt-6 shadow-md shadow-indigo-500/10"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Iniciando Sesión...</span>
                </>
              ) : (
                <span>Ingresar al Sistema</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Layout rendering begins
  return (
    <div
      className="min-h-screen text-slate-300 font-sans flex flex-col bg-[#0a0a0c]"
      style={{ fontSize: `${fontSize}px` }}
    >
      {/* Dynamic Toast Prompt Overlay */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-[#16161a] border border-white/10 text-white rounded-lg shadow-lg font-mono text-sm max-w-md text-center transition animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden no-print">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Drawer Menu Panel */}
          <aside className="relative flex w-64 max-w-[80vw] flex-col justify-between bg-[#0d0d10] p-5 border-r border-white/10 shadow-2xl h-full animate-in slide-in-from-left duration-250">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold tracking-tight text-white block truncate">
                    Detektor Menú
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-slate-400 border border-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation links duplicated inside Mobile drawer */}
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-3 mb-2">Administrador</p>
                
                <button
                  onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "dashboard" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
                >
                  <Activity className="w-4 h-4" />
                  <span>Resumen General</span>
                </button>

                <button
                  onClick={() => { navigateToPendientes(); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "pendientes" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
                >
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4" />
                    <span>Cobros Pendientes</span>
                  </div>
                  {overdueClients.length > 0 && (
                    <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-red-500/30">
                      {overdueClients.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { setActiveTab("clientes"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "clientes" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
                >
                  <Users className="w-4 h-4" />
                  <span>Clientes de Contrato</span>
                </button>

                <button
                  onClick={() => { setActiveTab("calendario"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "calendario" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
                >
                  <CalendarIcon className="w-4 h-4" />
                  <span>Calendario Mensual</span>
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-3 mb-2">FACTURACIÓN Y CAJA</p>

                <button
                  onClick={() => { setActiveTab("recibos"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "recibos" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Recibos Libres</span>
                </button>

                <button
                  onClick={() => { setActiveTab("ingresos"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "ingresos" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Reporte de Ingresos</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/5 pt-4">
              <div className="p-3 bg-[#16161a] rounded-xl border border-white/5 space-y-2">
                <span className="text-[10px] font-bold text-indigo-400 block uppercase tracking-wider">Sesión Activa</span>
                <p className="text-xs font-semibold text-white truncate">{userMetadata.name}</p>
                <p className="text-[9px] font-mono text-slate-400 leading-relaxed">
                  Empresa: {userMetadata.tenantId}<br />
                  Usuario ID: {userMetadata.userId}<br />
                  BD: {dbStatus.mode.toUpperCase()}
                </p>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full mt-2 py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] uppercase font-bold tracking-wider border border-red-500/20 transition-all text-center block"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Header Panel */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 sm:px-6 bg-[#0d0d10] no-print">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 hover:text-white text-slate-400 border border-white/10 md:hidden transition-all mr-0.5"
            title="Abrir Menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {empresa.logo ? (
            <div className="w-9 h-9 bg-white rounded-lg hidden sm:flex items-center justify-center p-1 border border-white/10 shadow-md overflow-hidden">
              <img
                src={getLogoSrc(empresa.logo)}
                className="max-w-full max-h-full object-contain"
                alt="Logo Empresa"
              />
            </div>
          ) : (
            <div className="w-9 h-9 bg-indigo-500 rounded-lg hidden sm:flex items-center justify-center text-white shadow-md active:scale-95 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <span className="text-xs sm:text-md font-semibold tracking-tight text-white block truncate max-w-[140px] xse:max-w-[180px] sm:max-w-xs md:max-w-none">
              {empresa.nombre}
            </span>
            <span className="text-[10px] text-slate-500 tracking-wider hidden sm:block">PORT 3000 • DYNAMODB SERVICE</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {dbStatus.error && (
            <div
              className="flex items-center gap-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md cursor-help max-w-[80px] xs:max-w-[150px] sm:max-w-[200px]"
              title={`Clic para ver error completo:\n\n${dbStatus.error}`}
              onClick={() => {
                triggerToast(`⚠️ Error BD: ${dbStatus.error}`);
              }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0"></div>
              <span className="text-[10px] font-semibold text-red-400 truncate" style={{ fontSize: `${parseInt(fontSize) - 2}px` }}>
                Error: {dbStatus.error}
              </span>
            </div>
          )}

          <div 
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${dbStatus.mode === "dynamo" ? "bg-green-500/10 border-green-500/20" : "bg-yellow-500/10 border-yellow-500/20"}`}
            title={dbStatus.mode === "dynamo" ? "DynamoDB: Online" : "Local: JSON Fallback"}
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dbStatus.mode === "dynamo" ? "bg-green-500" : "bg-yellow-500"}`}></div>
            <span className={`text-[10px] font-bold tracking-wider uppercase hidden md:inline ${dbStatus.mode === "dynamo" ? "text-green-400" : "text-yellow-400"}`}>
              {dbStatus.mode === "dynamo" ? "DynamoDB: Online" : "Local: JSON Fallback"}
            </span>
          </div>

          {/* Global Fonts Controls */}
          <div className="hidden md:flex items-center border-l border-white/10 pl-4 gap-1.5">
            <button
              onClick={() => changeFontSize(-1)}
              className="w-7 h-7 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 font-bold rounded flex items-center justify-center text-sm"
              title="Reducir Letra"
            >
              A-
            </button>
            <button
              onClick={() => changeFontSize(1)}
              className="w-7 h-7 bg-[#1c1c24] border border-white/10 hover:bg-white/20 text-white font-bold rounded flex items-center justify-center text-xs"
              title="Aumentar Letra"
            >
              A+
            </button>
          </div>

          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 hover:text-white flex items-center justify-center text-slate-400 border border-white/10 transition-colors flex-shrink-0"
            title="Configuración de Empresa"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={loadAllData}
            className={`p-1.5 text-slate-400 hover:text-white transition-colors flex-shrink-0 ${isSyncing ? "animate-spin" : ""}`}
            title="Sincronizar base de datos con servidor"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Structural Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="hidden md:flex w-64 border-r border-white/5 bg-[#0d0d10] p-5 flex-col justify-between no-print">
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-3 mb-2">Administrador</p>
              
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "dashboard" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
              >
                <Activity className="w-4 h-4" />
                <span>Resumen General</span>
              </button>

              <button
                onClick={navigateToPendientes}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "pendientes" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4" />
                  <span>Cobros Pendientes</span>
                </div>
                {overdueClients.length > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-red-500/30">
                    {overdueClients.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("clientes")}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "clientes" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
              >
                <Users className="w-4 h-4" />
                <span>Clientes de Contrato</span>
              </button>

              <button
                onClick={() => setActiveTab("calendario")}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "calendario" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
              >
                <CalendarIcon className="w-4 h-4" />
                <span>Calendario Mensual</span>
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-3 mb-2">FACTURACIÓN Y CAJA</p>

              <button
                onClick={() => setActiveTab("recibos")}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "recibos" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
              >
                <FileText className="w-4 h-4" />
                <span>Recibos Libres</span>
              </button>

              <button
                onClick={() => setActiveTab("ingresos")}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${activeTab === "ingresos" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-slate-400 hover:bg-white/5"}`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Reporte de Ingresos</span>
              </button>
            </div>
          </div>

          {/* Quick Info Box & User Session */}
          <div className="space-y-3 border-t border-white/5 pt-4">
            <div className="p-3 bg-[#16161a] rounded-xl border border-white/5 space-y-2">
              <span className="text-[10px] font-bold text-indigo-400 block uppercase tracking-wider">Sesión Activa</span>
              <p className="text-xs font-semibold text-white truncate">{userMetadata.name}</p>
              <p className="text-[9px] font-mono text-slate-400 leading-relaxed">
                Empresa: {userMetadata.tenantId}<br />
                Usuario ID: {userMetadata.userId}<br />
                BD: {dbStatus.mode.toUpperCase()}
              </p>
              <button
                onClick={handleLogout}
                className="w-full mt-2 py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] uppercase font-bold tracking-wider border border-red-500/20 transition-all text-center block cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </aside>

        {/* Content Viewer Viewport */}
        <main className="flex-1 p-3 md:p-6 overflow-y-auto bg-[#0a0a0c]">
          
          {/* TAB 1: DASHBOARD ACTIVE PANEL */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Overdue alert badge widget */}
              {overdueClients.length > 0 && (
                <div className="bg-red-950/20 border-2 border-red-500/20 rounded-xl p-4 flex items-center gap-3.5 text-red-400 shadow-md">
                  <AlertTriangle className="w-6 h-6 flex-shrink-0 animate-pulse text-red-500" />
                  <div>
                    <h4 className="font-bold text-sm">Alarma de Cuentas por Cobrar Vencidas</h4>
                    <p className="text-xs text-red-400/80 mt-0.5">Se detectaron <strong>{overdueClients.length}</strong> clientes con pagos de contrato vencidos. Favor de generar recordatorios manuales de inmediato.</p>
                  </div>
                  <button
                    onClick={navigateToPendientes}
                    className="ml-auto px-3 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs hover:bg-red-500/20 text-white font-medium"
                  >
                    Ver Cuentas
                  </button>
                </div>
              )}

              {/* Stats top grids */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="bg-[#16161a] p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                  <span className="text-xs text-slate-500 font-semibold mb-1 block">Contratos Activos</span>
                  <p className="text-2xl font-bold font-mono text-white mt-1">{activeClients.length}</p>
                </div>
                <div className="bg-[#16161a] p-4 rounded-xl border border-white/5">
                  <span className="text-xs text-slate-500 font-semibold mb- block">Cobros Vencidos</span>
                  <p className="text-2xl font-bold font-mono text-red-500 mt-1">{overdueClients.length}</p>
                </div>
                <div className="bg-[#16161a] p-4 rounded-xl border border-white/5">
                  <span className="text-xs text-slate-500 font-semibold mb-1 block">Toca Hoy</span>
                  <p className="text-2xl font-bold font-mono text-yellow-500 mt-1">{todayCobros.length}</p>
                </div>
                <div className="bg-[#16161a] p-4 rounded-xl border border-white/5">
                  <span className="text-xs text-slate-500 font-semibold mb-1 block">Esta Semana</span>
                  <p className="text-2xl font-bold font-mono text-indigo-400 mt-1">{weekCobros.length}</p>
                </div>
                <div className="bg-[#16161a] p-4 rounded-xl border border-white/10 flex flex-col justify-between col-span-2 bg-gradient-to-br from-indigo-950/20 to-purple-950/20">
                  <span className="text-xs text-indigo-400 font-bold block uppercase tracking-wider">Esperado Próx. 30 Días</span>
                  <p className="text-2xl font-extrabold text-white mt-1">${monthBillingExpected.toLocaleString()} MXN</p>
                </div>
              </div>

              {/* Grid split */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* Expected Billings Over the Next 7 Days */}
                <div className="xl:col-span-8 bg-[#16161a] rounded-xl border border-white/5 p-5 flex flex-col justify-between">
                  <div>
                    <h2 className="text-md font-bold text-white mb-1">Próximos Cobros de Alarma (Siguientes 7 Días)</h2>
                    <p className="text-xs text-slate-500 mb-4">Lista automatizada de clientes de contrato con cobro programado para esta semana.</p>
                  </div>

                  {weekCobros.length === 0 ? (
                    <div className="text-center p-8 text-slate-500">
                      <Check className="w-8 h-8 mx-auto text-green-500 mb-2 opacity-50" />
                      <p className="text-sm">No hay cobros recurrentes de alarmas para los próximos 7 días.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-widest">
                            <th className="py-2.5">Cuenta</th>
                            <th className="py-2.5">Cliente</th>
                            <th className="py-2.5">Servicio</th>
                            <th className="py-2.5">Frecuencia</th>
                            <th className="py-2.5">Importe</th>
                            <th className="py-2.5 text-right">Próximo Cobro</th>
                            <th className="py-2.5 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {weekCobros.map((c) => (
                            <tr key={c.id} className="hover:bg-white/5 active:scale-95 transition-all">
                              <td className="py-3 font-mono font-bold text-indigo-400">{c.cuenta}</td>
                              <td className="py-3 font-bold text-white">{c.nombre}</td>
                              <td className="py-3 text-slate-400">{c.servicio || "Monitoreo"}</td>
                              <td className="py-3">{FREQ_LABELS[c.freq]}</td>
                              <td className="py-3 font-bold text-green-400">
                                ${montoFinal(c).toLocaleString()}
                              </td>
                              <td className="py-3 text-right font-mono font-semibold text-slate-300">
                                {fmtDate(c.proximoCobro)}
                              </td>
                              <td className="py-3 text-center">
                                <button
                                  onClick={() => handleRegisterPayment(c.id)}
                                  className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 rounded font-semibold text-[10px]"
                                >
                                  Cobrar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Billing projection bar charts */}
                <div className="xl:col-span-4 bg-[#16161a] rounded-xl border border-white/5 p-5 flex flex-col">
                  <h2 className="text-md font-bold text-white mb-1">Proyección Semestral</h2>
                  <p className="text-xs text-slate-500 mb-6">Monto proyectado para renovaciones automáticas de contratos en los siguientes 6 meses.</p>
                  
                  <div className="flex-1 flex gap-2.5 items-end justify-between bg-black/40 p-4 rounded-lg border border-white/5 min-h-[160px]">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const projectionDate = new Date();
                      projectionDate.setMonth(projectionDate.getMonth() + i);
                      const monthLabel = projectionDate.toLocaleDateString("es-MX", { month: "short" });
                      const currentYear = projectionDate.getFullYear();
                      const currentMonth = projectionDate.getMonth();

                      const sum = clientes
                        .filter((x) => x.estado === "activo")
                        .filter((x) => {
                          const [py, pm] = x.proximoCobro.split("-").map(Number);
                          // Approximate mapping
                          return py === currentYear && pm - 1 === currentMonth;
                        })
                        .reduce((acc, currentVal) => acc + montoFinal(currentVal), 0);

                      const maxLimit = Math.max(...Array.from({ length: 6 }).map((_, idx) => {
                        const d = new Date(); d.setMonth(d.getMonth() + idx);
                        const cy = d.getFullYear(), cm = d.getMonth();
                        return clientes.filter(x => x.estado === "activo").filter(x => {
                          const [py, pm] = x.proximoCobro.split("-").map(Number);
                          return py === cy && pm - 1 === cm;
                        }).reduce((acc, curr) => acc + montoFinal(curr), 0);
                      }), 1000);

                      const completionPercent = Math.min(100, Math.max(8, Math.round((sum / maxLimit) * 100)));

                      return (
                        <div key={i} className="flex flex-col items-center flex-grow group">
                          <span className="text-[9px] font-mono font-bold text-green-400 mb-2 invisible group-hover:visible absolute -translate-y-5 bg-black/90 p-1 border rounded z-40">
                            ${sum.toLocaleString()}
                          </span>
                          <div className="w-full bg-white/5 rounded-t h-28 flex flex-col justify-end">
                            <div
                              style={{ height: `${completionPercent}%` }}
                              className="bg-indigo-500/80 rounded-t group-hover:bg-indigo-400 transition-all cursor-pointer"
                            ></div>
                          </div>
                          <span className="text-[9px] text-slate-500 mt-2 font-semibold uppercase">{monthLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Import/Export Action triggers footer console */}
              <div className="bg-[#121214] p-4 rounded-xl border border-white/5 flex flex-wrap gap-4 items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">Importar o Exportar Respaldos Generales</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Soporta hojas de cálculo CSV generadas en Excel o archivos completos de copia JSON.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSVData}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Exportar CSV
                  </button>
                  <button
                    onClick={() => document.getElementById("csv-file-importer")?.click()}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition"
                  >
                    <Upload className="w-4 h-4" /> Importar CSV
                  </button>
                  <input
                    type="file"
                    id="csv-file-importer"
                    accept=".csv"
                    className="hidden"
                    onChange={handleImportCSVData}
                  />
                  <button
                    onClick={handleOpenClientEditor.bind(null, null)}
                    className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/10 transition"
                  >
                    <Plus className="w-4 h-4" /> Registrar Cliente
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PENDIENTES */}
          {activeTab === "pendientes" && (
            <div className="space-y-6">
              <div className="flex justify-between items-end flex-wrap gap-4 bg-[#16161a] p-4 rounded-xl border border-white/5">
                <div>
                  <h2 className="text-lg font-bold text-white">Cobros Pendientes Recurrentes</h2>
                  <p className="text-xs text-slate-500">Manejo de estados de vencimiento y envío directo de avisos por WhatsApp.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-52">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por cliente o cuenta..."
                      value={spSearch}
                      onChange={(e) => {
                        setPagePend(1);
                        setSpSearch(e.target.value);
                      }}
                      className="pl-9 pr-4 py-1.5 text-xs bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 w-full"
                    />
                  </div>

                  <select
                    value={spFilter}
                    onChange={(e) => {
                      setPagePend(1);
                      setSpFilter(e.target.value);
                    }}
                    className="px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-lg text-white font-medium w-full sm:w-auto"
                  >
                    <option value="">Filtro: Todos</option>
                    <option value="overdue">⚠️ Vencidos únicamente</option>
                    <option value="today">🔔 Solo Hoy</option>
                    <option value="week">📅 Próximos 7 días</option>
                    <option value="month">📅 Próximos 30 días</option>
                  </select>
                </div>
              </div>

              {/* Pendientes Paginated list rendering */}
              {(() => {
                let list = clientes.filter((x) => x.estado !== "cancelado");
                if (spFilter === "overdue") {
                  list = list.filter((c) => diffDays(c.proximoCobro) < 0 && c.estado === "activo");
                } else if (spFilter === "today") {
                  list = list.filter((c) => diffDays(c.proximoCobro) === 0 && c.estado === "activo");
                } else if (spFilter === "week") {
                  list = list.filter((c) => {
                    const d = diffDays(c.proximoCobro);
                    return d >= 0 && d <= 7 && c.estado === "activo";
                  });
                } else if (spFilter === "month") {
                  list = list.filter((c) => {
                    const d = diffDays(c.proximoCobro);
                    return d >= 0 && d <= 30 && c.estado === "activo";
                  });
                }

                const filtered = filterClients(list, spSearch, "");
                const sorted = getSortedList(filtered, sortPend);

                const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
                const currentChunk = sorted.slice((pagePend - 1) * PAGE_SIZE, pagePend * PAGE_SIZE);

                if (sorted.length === 0) {
                  return (
                    <div className="text-center p-12 bg-[#16161a] rounded-xl border border-white/5 text-slate-500">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-500" />
                      <p className="text-sm">No se encontraron cobros activos que correspondan a los filtros seleccionados.</p>
                    </div>
                  );
                }

                const toggleSortPending = (col: keyof Cliente | "montoFinal") => {
                  const toAsc = sortPend.col === col ? !sortPend.asc : true;
                  setSortPend({ col, asc: toAsc });
                  setPagePend(1);
                };

                return (
                  <div className="space-y-4">
                    <div className="bg-[#16161a] rounded-xl border border-white/5 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1e1e24]/50 text-slate-400 font-bold border-b border-white/5">
                            <tr>
                              <th className="p-3 cursor-pointer" onClick={() => toggleSortPending("cuenta")}>
                                Cuenta / ID{getSortArrow("cuenta", sortPend.col, sortPend.asc)}
                              </th>
                              <th className="p-3 cursor-pointer" onClick={() => toggleSortPending("nombre")}>
                                Cliente{getSortArrow("nombre", sortPend.col, sortPend.asc)}
                              </th>
                              <th className="p-3">Teléfono</th>
                              <th className="p-3">Servicio programado</th>
                              <th className="p-3 cursor-pointer" onClick={() => toggleSortPending("montoFinal")}>
                                Importe{getSortArrow("montoFinal", sortPend.col, sortPend.asc)}
                              </th>
                              <th className="p-3 cursor-pointer" onClick={() => toggleSortPending("proximoCobro")}>
                                Próxima fecha{getSortArrow("proximoCobro", sortPend.col, sortPend.asc)}
                              </th>
                              <th className="p-3">Estado</th>
                              <th className="p-3 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {currentChunk.map((c) => {
                              const days = diffDays(c.proximoCobro);
                              const overdue = days < 0 && c.estado === "activo";
                              const isToday = days === 0 && c.estado === "activo";

                              let rowBg = "hover:bg-white/5";
                              if (overdue) rowBg = "bg-red-500/[0.02] hover:bg-red-500/[0.04]";
                              else if (isToday) rowBg = "bg-yellow-500/[0.02] hover:bg-yellow-500/[0.04]";

                              return (
                                <tr key={c.id} className={`${rowBg} transition-all`}>
                                  <td className="p-3 font-mono font-bold text-indigo-400">{c.cuenta}</td>
                                  <td
                                    className="p-3 font-bold text-white cursor-pointer hover:underline"
                                    onClick={() => handleOpenClientEditor(c)}
                                  >
                                    {c.nombre}
                                  </td>
                                  <td className="p-3 text-slate-400 font-mono">
                                    <div>{c.tel || "—"}</div>
                                    {c.contactos && c.contactos.length > 0 && (
                                      <details className="group mt-1 cursor-pointer">
                                        <summary className="list-none flex items-center gap-1 text-[10px] text-indigo-400 font-bold hover:text-indigo-300 font-sans focus:outline-none">
                                          <svg xmlns="http://www.w3.org/2050/svg" className="w-2.5 h-2.5 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                          <span>Contactos ({c.contactos.length})</span>
                                        </summary>
                                        <div className="mt-1.5 space-y-1 text-[10px] text-slate-400 font-normal font-sans group-open:animate-fadeIn">
                                          {c.contactos.map((contact, idx) => (
                                            <div key={idx} className="flex flex-col gap-1 bg-white/5 p-1.5 rounded text-slate-300 max-w-[200px] border border-white/5">
                                              <div className="flex flex-col min-w-0">
                                                <span className="font-semibold text-indigo-400 truncate" title={contact.nombre}>{contact.nombre || "Sin Nombre"}:</span>
                                                <span className="font-mono text-[9px] text-slate-400">{contact.cel || "—"}</span>
                                              </div>
                                              {contact.cel && (
                                                <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
                                                  <a
                                                    href={`tel:${contact.cel.replace(/\D/g, "")}`}
                                                    className="flex-1 py-0.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 rounded text-[8px] font-bold flex items-center justify-center gap-0.5 transition active:scale-95"
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                                    Llamar
                                                  </a>
                                                  <a
                                                    href={`https://wa.me/${contact.cel.replace(/\D/g, "")}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 py-0.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 rounded text-[8px] font-bold flex items-center justify-center gap-0.5 transition active:scale-95"
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                                    WhatsApp
                                                  </a>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    )}
                                  </td>
                                  <td className="p-3 text-slate-400 font-medium">
                                    {c.servicio || "Monitoreo"}
                                    {c.desc && <span className="block text-[10px] text-slate-500">{c.desc}</span>}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-white">
                                    ${montoFinal(c).toLocaleString()}
                                    {c.descuento > 0 && (
                                      <span className="text-[10px] text-yellow-500 block">-{c.descuento}% desc.</span>
                                    )}
                                  </td>
                                  <td className="p-3 font-mono font-semibold">
                                    <span>{fmtDate(c.proximoCobro)}</span>
                                    {overdue && (
                                      <span className="block text-[10px] text-red-500 font-bold">Vencido ({Math.abs(days)}d)</span>
                                    )}
                                    {isToday && (
                                      <span className="block text-[10px] text-yellow-500 font-bold">🔔 ¡Fórmula Hoy!</span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      c.estado === "activo" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                                    }`}>
                                      {c.estado}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex gap-2 justify-center">
                                      <button
                                        onClick={() => handleRegisterPayment(c.id)}
                                        className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white font-bold rounded text-[10px]"
                                      >
                                        Cobrar
                                      </button>
                                      <button
                                        onClick={() => handleSendWhatsAppNotification(c)}
                                        className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded text-[10px] flex items-center gap-1"
                                        title="WhatsApp"
                                      >
                                        Aviso
                                      </button>
                                      <button
                                        onClick={() => handleOpenClientEditor(c)}
                                        className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10px]"
                                      >
                                        Editar
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pagination Controllers */}
                    {totalPages > 1 && (
                      <div className="flex justify-between items-center bg-[#16161a] p-3 rounded-xl border border-white/5 text-xs">
                        <span className="text-slate-500">
                          Página <strong>{pagePend}</strong> de {totalPages} ({sorted.length} registros)
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            disabled={pagePend === 1}
                            onClick={() => setPagePend((p) => Math.max(1, p - 1))}
                            className="p-1 px-2.5 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 rounded text-slate-200"
                          >
                            Anterior
                          </button>
                          <button
                            disabled={pagePend === totalPages}
                            onClick={() => setPagePend((p) => Math.min(totalPages, p + 1))}
                            className="p-1 px-2.5 bg-[#1c1c24] border border-white/10 hover:bg-white/20 disabled:opacity-30 rounded text-white font-bold"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: CLIENTES */}
          {activeTab === "clientes" && (
            <div className="space-y-6">
              <div className="flex justify-between items-end flex-wrap gap-4 bg-[#16161a] p-4 rounded-xl border border-white/5">
                <div>
                  <h2 className="text-lg font-bold text-white font-sans">Catálogo General de Clientes Registrados</h2>
                  <p className="text-xs text-slate-500">Soporta filtrado integral por contratos suspendidos, cancelados o activos.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Nombre, rfc, dirección..."
                      value={scSearch}
                      onChange={(e) => {
                        setPageClientes(1);
                        setScSearch(e.target.value);
                      }}
                      className="pl-9 pr-4 py-1.5 text-xs bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 w-full"
                    />
                  </div>

                  <select
                    value={scFilter}
                    onChange={(e) => {
                      setPageClientes(1);
                      setScFilter(e.target.value);
                    }}
                    className="px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-lg text-white font-medium w-full sm:w-auto"
                  >
                    <option value="">Estado: Todos</option>
                    <option value="activo">✅ Activos únicamente</option>
                    <option value="suspendido">⏸ Suspendidos</option>
                    <option value="cancelado">❌ Cancelados</option>
                  </select>
                </div>
              </div>

              {/* Clientes Table */}
              {(() => {
                const filtered = filterClients(clientes, scSearch, scFilter);
                const sorted = getSortedList(filtered, sortClientes);

                const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
                const currentChunk = sorted.slice((pageClientes - 1) * PAGE_SIZE, pageClientes * PAGE_SIZE);

                if (sorted.length === 0) {
                  return (
                    <div className="text-center p-12 bg-[#16161a] rounded-xl border border-white/5 text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-500" />
                      <p className="text-sm">Ningún cliente se ajusta a los términos de la consulta actual.</p>
                    </div>
                  );
                }

                const toggleSortClients = (col: keyof Cliente | "montoFinal") => {
                  const toAsc = sortClientes.col === col ? !sortClientes.asc : true;
                  setSortClientes({ col, asc: toAsc });
                  setPageClientes(1);
                };

                return (
                  <div className="space-y-4">
                    <div className="bg-[#16161a] rounded-xl border border-white/5 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1e1e24]/50 text-slate-400 font-bold border-b border-white/5">
                            <tr>
                              <th className="p-3 cursor-pointer" onClick={() => toggleSortClients("cuenta")}>
                                Cuenta{getSortArrow("cuenta", sortClientes.col, sortClientes.asc)}
                              </th>
                              <th className="p-3 cursor-pointer" onClick={() => toggleSortClients("nombre")}>
                                Nombre{getSortArrow("nombre", sortClientes.col, sortClientes.asc)}
                              </th>
                              <th className="p-3">Teléfono</th>
                              <th className="p-3">Servicio de Contrato</th>
                              <th className="p-3">Frecuencia</th>
                              <th className="p-3 cursor-pointer" onClick={() => toggleSortClients("montoFinal")}>
                                Monto Final{getSortArrow("montoFinal", sortClientes.col, sortClientes.asc)}
                              </th>
                              <th className="p-3 cursor-pointer" onClick={() => toggleSortClients("proximoCobro")}>
                                Próxima fecha{getSortArrow("proximoCobro", sortClientes.col, sortClientes.asc)}
                              </th>
                              <th className="p-3">Estado</th>
                              <th className="p-3 text-center">Gestión</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-slate-300">
                          {currentChunk.map((c) => (
                            <tr key={c.id} className="hover:bg-white/5 transition-all">
                              <td className="p-3 font-mono font-bold text-indigo-400">{c.cuenta}</td>
                              <td className="p-3 font-bold text-white">{c.nombre}</td>
                              <td className="p-3 font-mono text-slate-400">
                                <div>{c.tel || "—"}</div>
                                {c.contactos && c.contactos.length > 0 && (
                                  <details className="group mt-1 cursor-pointer">
                                    <summary className="list-none flex items-center gap-1 text-[10px] text-indigo-400 font-bold hover:text-indigo-300 font-sans focus:outline-none">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                      <span>Contactos ({c.contactos.length})</span>
                                    </summary>
                                    <div className="mt-1.5 space-y-1 text-[10px] text-slate-400 font-normal font-sans group-open:animate-fadeIn">
                                      {c.contactos.map((contact, idx) => (
                                        <div key={idx} className="flex flex-col gap-1 bg-white/5 p-1.5 rounded text-slate-300 max-w-[200px] border border-white/5">
                                          <div className="flex flex-col min-w-0">
                                            <span className="font-semibold text-indigo-400 truncate" title={contact.nombre}>{contact.nombre || "Sin Nombre"}:</span>
                                            <span className="font-mono text-[9px] text-slate-400">{contact.cel || "—"}</span>
                                          </div>
                                          {contact.cel && (
                                            <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
                                              <a
                                                href={`tel:${contact.cel.replace(/\D/g, "")}`}
                                                className="flex-1 py-0.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 rounded text-[8px] font-bold flex items-center justify-center gap-0.5 transition active:scale-95"
                                              >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                                Llamar
                                              </a>
                                              <a
                                                href={`https://wa.me/${contact.cel.replace(/\D/g, "")}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 py-0.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 rounded text-[8px] font-bold flex items-center justify-center gap-0.5 transition active:scale-95"
                                              >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                                WhatsApp
                                              </a>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </td>
                              <td className="p-3 text-slate-400 font-medium">
                                {c.servicio || "—"}
                                {c.desc && <span className="block text-[10px] text-slate-500 font-normal">{c.desc}</span>}
                              </td>
                              <td className="p-3 font-semibold">{FREQ_LABELS[c.freq]}</td>
                              <td className="p-3 font-mono font-bold text-white">${montoFinal(c).toLocaleString()}</td>
                              <td className="p-3 font-mono">{fmtDate(c.proximoCobro)}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  c.estado === "activo" ? "bg-green-500/10 text-green-400 border border-green-500/20" : 
                                  c.estado === "suspendido" ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : 
                                  "bg-white/5 text-slate-500 border border-white/10"
                                }`}>
                                  {c.estado}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => handleOpenClientEditor(c)}
                                    className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10px] flex items-center gap-1 border border-white/10"
                                  >
                                    Editar
                                  </button>
                                  {(c.pagos || []).length > 0 ? (
                                    <button
                                      onClick={() => {
                                        setActiveReceiptClient(c);
                                        setActiveReceiptSelectedFecha("");
                                        setActiveCustomReceipt(null);
                                        setIsReceiptModalOpen(true);
                                      }}
                                      className="px-1.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded text-[10px] flex items-center gap-1 border border-indigo-500/20"
                                      title="Imprimir historial completo"
                                    >
                                      Historial ({(c.pagos || []).length})
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                    {/* Pagination controllers */}
                    {totalPages > 1 && (
                      <div className="flex justify-between items-center bg-[#16161a] p-3 rounded-xl border border-white/5 text-xs">
                        <span className="text-slate-500">
                          Página <strong>{pageClientes}</strong> de {totalPages} ({sorted.length} registros)
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            disabled={pageClientes === 1}
                            onClick={() => setPageClientes((p) => Math.max(1, p - 1))}
                            className="p-1 px-2.5 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 rounded text-slate-200"
                          >
                            Anterior
                          </button>
                          <button
                            disabled={pageClientes === totalPages}
                            onClick={() => setPageClientes((p) => Math.min(totalPages, p + 1))}
                            className="p-1 px-2.5 bg-[#1c1c24] border border-white/10 hover:bg-white/20 disabled:opacity-30 rounded text-white font-bold"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 4: CALENDARIO MENSUAL DE CONTRATOS */}
          {activeTab === "calendario" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-center bg-[#16161a] p-4 rounded-xl border border-white/5 gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (calM === 0) {
                        setCalM(11);
                        setCalY((y) => y - 1);
                      } else {
                        setCalM((m) => m - 1);
                      }
                    }}
                    className="p-1.5 bg-white/5 rounded border border-white/10 text-white hover:bg-white/10 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm sm:text-md font-extrabold text-white uppercase tracking-wider select-none min-w-[140px] sm:min-w-[180px] text-center">
                    {new Date(calY, calM, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
                  </h3>
                  <button
                    onClick={() => {
                      if (calM === 11) {
                        setCalM(0);
                        setCalY((y) => y + 1);
                      } else {
                        setCalM((m) => m + 1);
                      }
                    }}
                    className="p-1.5 bg-white/5 rounded border border-white/10 text-white hover:bg-white/10 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-widest bg-black/40 px-3 py-1 rounded border border-white/5 text-center w-full sm:w-auto">
                  Vencimientos de Servicio del Periodo
                </p>
              </div>

              {/* Monthly calendar structure */}
              {(() => {
                const firstDayIndex = new Date(calY, calM, 1).getDay();
                const totalDaysInMonth = new Date(calY, calM + 1, 0).getDate();
                const daysArray = Array.from({ length: totalDaysInMonth }, (_, idx) => idx + 1);
                
                // Group calendar events
                const eventsMap: Record<number, Cliente[]> = {};
                clientes
                  .filter((x) => x.estado !== "cancelado")
                  .forEach((c) => {
                    const [cy, cm, cd] = c.proximoCobro.split("-").map(Number);
                    if (cy === calY && cm - 1 === calM) {
                      if (!eventsMap[cd]) eventsMap[cd] = [];
                      eventsMap[cd].push(c);
                    }
                  });

                return (
                  <div className="overflow-x-auto pb-2">
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[640px] md:min-w-0">
                      {/* Days of the week header */}
                      {["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((day) => (
                        <div key={day} className="text-center py-2 text-xs font-bold uppercase tracking-wider text-slate-500 bg-[#16161a] border border-white/5 rounded-md">
                          {day.slice(0, 3)}
                        </div>
                      ))}

                      {/* Pre-spaces in month */}
                      {Array.from({ length: firstDayIndex }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="min-h-[80px] bg-transparent border border-transparent rounded-lg"></div>
                      ))}

                      {/* True days elements */}
                      {daysArray.map((dayNum) => {
                        const dayEvents = eventsMap[dayNum] || [];
                        const today = new Date();
                        const isToday =
                          today.getDate() === dayNum &&
                          today.getMonth() === calM &&
                          today.getFullYear() === calY;

                        return (
                          <div
                            key={`day-${dayNum}`}
                            className={`min-h-[70px] sm:min-h-[85px] p-2 rounded-lg border-2 flex flex-col justify-between transition-all bg-[#0d0d10] ${
                              isToday ? "border-indigo-500 bg-indigo-500/5 shadow-md flex-grow" : "border-white/5 hover:border-slate-700 hover:bg-white/[0.01]"
                            }`}
                          >
                            <span className={`text-xs font-bold block ${isToday ? "text-indigo-400 font-extrabold" : "text-slate-400"}`}>
                              {dayNum}
                            </span>
                            
                            <div className="space-y-1 mt-1 max-h-[60px] overflow-y-auto w-full">
                              {dayEvents.map((ev) => {
                                const daysDiff = diffDays(ev.proximoCobro);
                                const isOverdue = daysDiff < 0 && ev.estado === "activo";
                                const textCls = isOverdue ? "text-red-400 bg-red-400/10 border-red-500/20" : "text-indigo-400 bg-indigo-400/10 border-indigo-500/20";
                                
                                return (
                                  <div
                                    key={ev.id}
                                    onClick={() => handleOpenClientEditor(ev)}
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-tight truncate cursor-pointer transition active:scale-95 ${textCls}`}
                                    title={`${ev.cuenta}\n${ev.nombre}\n$${montoFinal(ev).toLocaleString()}`}
                                  >
                                    {ev.nombre.split(" ")[0]}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 5: RECIBOS PERSONALIZADOS POR CONCEPTOS */}
          {activeTab === "recibos" && (
            <CustomReceiptsTab
              recibos={recibos}
              clientes={clientes}
              onSaveRecibo={handleSaveCustomReceipt}
              onDeleteRecibo={handleDeleteCustomReceipt}
              onVerRecibo={(r) => {
                setActiveCustomReceipt(r);
                setActiveReceiptClient(undefined);
                setIsReceiptModalOpen(true);
              }}
              showToast={triggerToast}
            />
          )}

          {/* TAB 6: HISTORIAL DE INGRESOS */}
          {activeTab === "ingresos" && (
            <div className="space-y-6">
              {/* Header and Date Range Controls */}
              <div className="bg-[#16161a] p-5 rounded-xl border border-white/5 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-start gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white font-sans">Reporte de Caja Global de Ingresos</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Visualice y analice los ingresos totales de monitoreo recurrentes y recibos libres dentro del rango.
                    </p>
                  </div>

                  <div className="flex flex-row gap-3 items-end w-full md:w-auto">
                    <div className="field flex-1 md:flex-none">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Desde</label>
                      <input
                        type="date"
                        value={repDesde}
                        onChange={(e) => setRepDesde(e.target.value)}
                        className="p-1 px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 w-full"
                      />
                    </div>
                    <div className="field flex-1 md:flex-none">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Hasta</label>
                      <input
                        type="date"
                        value={repHasta}
                        onChange={(e) => setRepHasta(e.target.value)}
                        className="p-1 px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Date Picker Presets */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5 items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-2">Rangos rápidos:</span>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const mm1 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
                      setRepDesde(mm1);
                      setRepHasta(todayStr);
                    }}
                    className="px-2 py-1 text-[11px] bg-black/40 text-slate-300 hover:text-white rounded border border-white/5 hover:border-white/20 transition"
                  >
                    Este Mes
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const y = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
                      const m = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
                      const lastDay = new Date(y, m + 1, 0).getDate();
                      const dDesde = `${y}-${String(m + 1).padStart(2, "0")}-01`;
                      const dHasta = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                      setRepDesde(dDesde);
                      setRepHasta(dHasta);
                    }}
                    className="px-2 py-1 text-[11px] bg-black/40 text-slate-300 hover:text-white rounded border border-white/5 hover:border-white/20 transition"
                  >
                    Mes Anterior
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const prev30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                      const dDesde = prev30.toISOString().split("T")[0];
                      setRepDesde(dDesde);
                      setRepHasta(todayStr);
                    }}
                    className="px-2 py-1 text-[11px] bg-black/40 text-slate-300 hover:text-white rounded border border-white/5 hover:border-white/20 transition"
                  >
                    Últimos 30 días
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const dDesde = `${today.getFullYear()}-01-01`;
                      setRepDesde(dDesde);
                      setRepHasta(todayStr);
                    }}
                    className="px-2 py-1 text-[11px] bg-black/40 text-slate-300 hover:text-white rounded border border-white/5 hover:border-white/20 transition"
                  >
                    Este Año
                  </button>
                  <button
                    onClick={() => {
                      setRepDesde("2020-01-01");
                      setRepHasta(todayStr);
                    }}
                    className="px-2 py-1 text-[11px] bg-black/40 text-slate-300 hover:text-white rounded border border-white/5 hover:border-white/20 transition"
                  >
                    Todo el historial
                  </button>
                </div>
              </div>

              {/* Bento Stats Collected Box */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Overall Balance Display */}
                <div className="bg-[#16161a] p-5 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 via-[#16161a] to-[#121215] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-emerald-400 font-extrabold uppercase tracking-wide">Recaudación Total General</span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 font-bold uppercase">Caja Unificada</span>
                    </div>
                    <div className="text-3xl font-mono text-green-400 font-black tracking-tight mt-3">
                      ${totalCollectedInPeriod.toLocaleString("es-MX", { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500 font-sans">MXN</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Suma general de contratos y recibos libres en fechas seleccionadas.
                  </p>
                </div>

                {/* 2. Subscription Details */}
                <div className="bg-[#16161a] p-5 rounded-xl border border-indigo-500/10 bg-gradient-to-br from-indigo-950/10 via-[#16161a] to-[#121215] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-indigo-400 font-extrabold uppercase tracking-wide">Pagos Fijos (Suscripción)</span>
                      <span className="text-[10px] text-slate-400 font-mono font-bold bg-white/5 rounded px-2 py-0.5">{countSuscripcionesInPeriod} cobro(s)</span>
                    </div>
                    <div className="text-2xl font-mono text-white font-extrabold mt-3">
                      ${totalSuscripcionesInPeriod.toLocaleString("es-MX", { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500">MXN</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-indigo-300 mt-2 flex items-center justify-between">
                    <span>Monitoreo recurrente de alarmas</span>
                    <span>{totalCollectedInPeriod > 0 ? Math.round((totalSuscripcionesInPeriod / totalCollectedInPeriod) * 100) : 0}% del total</span>
                  </div>
                </div>

                {/* 3. Custom Receipts Details */}
                <div className="bg-[#16161a] p-5 rounded-xl border border-amber-500/10 bg-gradient-to-br from-amber-950/10 via-[#16161a] to-[#121215] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-amber-400 font-extrabold uppercase tracking-wide">Recibos Libres (Remisiones)</span>
                      <span className="text-[10px] text-slate-400 font-mono font-bold bg-white/5 rounded px-2 py-0.5">{countLibresInPeriod} recibo(s)</span>
                    </div>
                    <div className="text-2xl font-mono text-white font-extrabold mt-3">
                      ${totalLibresInPeriod.toLocaleString("es-MX", { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500">MXN</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-amber-300 mt-2 flex items-center justify-between">
                    <span>Accesorios, visitas y facturas libres</span>
                    <span>{totalCollectedInPeriod > 0 ? Math.round((totalLibresInPeriod / totalCollectedInPeriod) * 100) : 0}% del total</span>
                  </div>
                </div>
              </div>

              {/* List with Controls and Search */}
              <div className="bg-[#16161a] rounded-xl border border-white/5 overflow-hidden">
                {/* Table Inner Toolbars */}
                <div className="p-4 bg-black/20 border-b border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                  {/* Category Filter Buttons */}
                  <div className="flex bg-black/30 p-1 rounded-lg border border-white/10 w-full md:w-auto">
                    <button
                      onClick={() => setRepType("todos")}
                      className={`flex-1 md:flex-none px-3 py-1 text-xs font-medium rounded-md transition ${repType === "todos" ? "bg-indigo-500/15 text-indigo-400 font-bold border border-indigo-500/30" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Todos los cobros ({filteredIncomePayments.length})
                    </button>
                    <button
                      onClick={() => setRepType("suscripciones")}
                      className={`flex-1 md:flex-none px-3 py-1 text-xs font-medium rounded-md transition ${repType === "suscripciones" ? "bg-indigo-500/15 text-indigo-400 font-bold border border-indigo-500/30" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Suscripciones ({unionTransactions.filter(t => t.type === "suscripcion").filter(t => (!repDesde || t.fecha >= repDesde) && (!repHasta || t.fecha <= repHasta)).length})
                    </button>
                    <button
                      onClick={() => setRepType("recibos")}
                      className={`flex-1 md:flex-none px-3 py-1 text-xs font-medium rounded-md transition ${repType === "recibos" ? "bg-indigo-500/15 text-indigo-400 font-bold border border-indigo-500/30" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Recibos libres ({unionTransactions.filter(t => t.type === "libre").filter(t => (!repDesde || t.fecha >= repDesde) && (!repHasta || t.fecha <= repHasta)).length})
                    </button>
                  </div>

                  {/* Search text box inside list */}
                  <div className="relative w-full md:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, cuenta, folio..."
                      value={repSearch}
                      onChange={(e) => setRepSearch(e.target.value)}
                      className="w-full bg-black/40 text-slate-200 placeholder-slate-500 text-xs p-2 pl-9 rounded-lg border border-white/10 focus:outline-none focus:border-indigo-500"
                    />
                    {repSearch && (
                      <button onClick={() => setRepSearch("")} className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 text-xs font-bold font-sans">
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Table or Empty status */}
                {filteredIncomePayments.length === 0 ? (
                  <div className="text-center p-12 text-slate-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20 text-indigo-500" />
                    <p className="text-sm font-semibold">No se encontraron transacciones registradas</p>
                    <p className="text-xs text-slate-600 mt-1">Pruebe ampliando el rango de fechas, seleccionando otra categoría o limpiando la búsqueda.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#1e1e24]/30 text-slate-400 font-bold border-b border-white/5">
                        <tr>
                          <th className="p-3">Sincronización</th>
                          <th className="p-3">Categoría</th>
                          <th className="p-3">Cuenta / Identidad</th>
                          <th className="p-3">Cliente</th>
                          <th className="p-3">Concepto Cobrado</th>
                          <th className="p-3">Método Pago</th>
                          <th className="p-3">Folio/Recibo</th>
                          <th className="p-3 text-right">Importe Cobrado</th>
                          <th className="p-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300">
                        {filteredIncomePayments.slice().reverse().map((t, idx) => (
                          <tr key={t.id} className="hover:bg-white/5 transition-all">
                            {/* Fecha */}
                            <td className="p-3 font-mono font-medium text-slate-500">{fmtDate(t.fecha)}</td>
                            
                            {/* Tipo de categoría badge */}
                            <td className="p-3">
                              {t.type === "suscripcion" ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-md px-1.5 py-0.5">
                                  Suscripción
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-md px-1.5 py-0.5">
                                  Recibo Libre
                                </span>
                              )}
                            </td>

                            {/* Cuenta */}
                            <td className="p-3 font-mono text-slate-400 font-semibold">{t.cuenta}</td>

                            {/* Nombre Cliente */}
                            <td className="p-3 font-bold text-white max-w-[160px] truncate" title={t.nombre}>{t.nombre}</td>

                            {/* Concepto */}
                            <td className="p-3 text-slate-400 max-w-[200px] truncate" title={t.servicio}>
                              <span>{t.servicio}</span>
                              {t.type === "suscripcion" && (
                                <span className="block text-[9px] text-slate-500 font-sans">Periodo: {fmtDate(t.periodoDesde)} al {fmtDate(t.periodoHasta)}</span>
                              )}
                            </td>

                            {/* Metodo de Pago */}
                            <td className="p-3 text-slate-400 capitalize">
                              <span className="inline-flex items-center gap-1">
                                {t.metodo === "efectivo" ? "💵 Efectivo" :
                                 t.metodo === "transferencia" ? "📱 Transferencia" :
                                 t.metodo === "tarjeta" ? "💳 Tarjeta" :
                                 t.metodo === "otro" ? "🧾 Otro" : t.metodo}
                              </span>
                            </td>

                            {/* Folio / Recibo */}
                            <td className="p-3 font-mono font-semibold text-slate-300">{t.recibo}</td>

                            {/* Monto de cobro */}
                            <td className="p-3 text-right font-mono font-bold text-green-400">
                              ${t.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>

                            {/* Acciones */}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => {
                                  if (t.type === "suscripcion") {
                                    const selectedClient = clientes.find((x) => x.id === t.cliId);
                                    if (!selectedClient) return triggerToast("⚠️ Cliente de base de datos no encontrado.");
                                    setActiveReceiptClient(selectedClient);
                                    setActiveReceiptSelectedFecha(t.fecha);
                                    setActiveCustomReceipt(null);
                                    setIsReceiptModalOpen(true);
                                  } else {
                                    if (!t.rawRecibo) return triggerToast("⚠️ Error al obtener los datos de este recibo.");
                                    setActiveCustomReceipt(t.rawRecibo);
                                    setActiveReceiptClient(undefined);
                                    setIsReceiptModalOpen(true);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-indigo-500/10 hover:text-indigo-400 text-slate-400 rounded-md transition border border-white/10 active:scale-95"
                              >
                                <Printer className="w-3 h-3" /> Imprimir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MODAL WINDOW 1: CLIENT BUILDER OR EDITOR */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-250 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                  {editingClient ? "Actualizar Parámetros de Cliente" : "Registrar Cliente de Contrato"}
                </h3>
              </div>
              <button
                onClick={() => setIsClientModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              
              {/* Account properties */}
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Paso 1: Identificación de Cuenta</p>
                <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 border border-white/5 rounded-xl">
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">No de Cuenta (Detektor ID)</label>
                    <input
                      type="text"
                      placeholder="Ej. SEC-1002"
                      value={fCuenta}
                      onChange={(e) => setFCuenta(e.target.value)}
                      className="p-2 text-xs bg-black/80 border border-white/10 rounded-lg text-white font-mono"
                    />
                    <span className="text-[9px] text-slate-500 block mt-1">Manual o autogenerado por sistema</span>
                  </div>
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block font-sans">Estado del Contrato</label>
                    <select
                      value={fEstado}
                      onChange={(e) => setFEstado(e.target.value as any)}
                      className="p-2 text-xs bg-black/80 border border-white/10 rounded-lg text-white"
                    >
                      <option value="activo">✅ Activo (Vigente)</option>
                      <option value="suspendido">⏸ Suspendido temporal</option>
                      <option value="cancelado">❌ Cancelado definitivo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Personal values */}
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 mt-2">Paso 2: Datos del Cliente y Contactos</p>
                <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 border border-white/5 rounded-xl">
                  <div className="field col-span-2">
                    <label className="text-[10px] font-bold text-slate-450 uppercase mb-1 block">Razón social / Nombre Completo <span className="text-red-500 font-bold">*</span></label>
                    <input
                      type="text"
                      placeholder="Ej. Juan Pérez García"
                      value={fNombre}
                      onChange={(e) => setFNombre(e.target.value)}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Teléfono Principal</label>
                    <input
                      type="text"
                      placeholder="6140000000"
                      value={fTel}
                      onChange={(e) => setFTel(e.target.value)}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Correo Electrónico</label>
                    <input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={fEmail}
                      onChange={(e) => setFEmail(e.target.value)}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div className="col-span-2 bg-[#0c101b] border border-white/5 rounded-xl p-4 my-2">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <i className="ti ti-users text-xs"></i> Contactos del Cliente / Alarmas ({fContactos.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setFContactos(prev => [...prev, { nombre: "", cel: "" }])}
                        className="text-[10px] font-bold px-2.5 py-1 bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 rounded border border-indigo-500/20 active:scale-95 transition flex items-center gap-1"
                      >
                        + Agregar Contacto
                      </button>
                    </div>

                    {fContactos.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-[11px] text-slate-500 italic">
                          No hay contactos de alarma registrados. Presiona "+ Agregar Contacto" para añadir más de un contacto si lo deseas.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                        {fContactos.map((cont, index) => (
                          <div key={index} className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-white/5 animate-fadeIn">
                            <div className="flex-1 min-w-0">
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wide">Nombre del Contacto</label>
                              <input
                                type="text"
                                placeholder="Ej. Juan Pérez (Hijo)"
                                value={cont.nombre}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFContactos(prev => prev.map((item, i) => i === index ? { ...item, nombre: val } : item));
                                }}
                                className="w-full p-1.5 text-xs bg-black/50 border border-white/10 rounded-md text-white md:bg-black/70"
                              />
                            </div>
                            <div className="w-[140px] md:w-[170px]">
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wide font-sans">WhatsApp (Celular)</label>
                              <input
                                type="text"
                                placeholder="Ej. 6140000000"
                                value={cont.cel}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFContactos(prev => prev.map((item, i) => i === index ? { ...item, cel: val } : item));
                                }}
                                className="w-full p-1.5 text-xs bg-black/50 border border-white/10 rounded-md text-white font-mono md:bg-black/70"
                              />
                            </div>
                            <div className="self-end pb-0.5">
                              <button
                                type="button"
                                onClick={() => setFContactos(prev => prev.filter((_, i) => i !== index))}
                                className="p-1.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-md active:scale-95 transition"
                                title="Eliminar contacto"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="field col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">RFC / Identificación Fiscal</label>
                    <input
                      type="text"
                      placeholder="Ej. PEPJ800101XXX"
                      value={fRfc}
                      onChange={(e) => setFRfc(e.target.value)}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div className="field col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Dirección de Inmueble Asegurado</label>
                    <input
                      type="text"
                      placeholder="Calle, Colonia, Ciudad, Estado"
                      value={fDir}
                      onChange={(e) => setFDir(e.target.value)}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Service Details with Predefined quick catalog selection */}
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 mt-2">Paso 3: Parámetros del Servicio Recurrente</p>
                <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 border border-white/5 rounded-xl space-y-1">
                  
                  {serviciosCatalogo.length > 0 && (
                    <div className="field col-span-2 bg-indigo-500/[0.03] p-2 rounded-lg border border-indigo-500/10 mb-2">
                      <label className="text-[9px] font-bold text-indigo-300 block mb-1">Cargar Autofórmula desde Catálogo de Servicios</label>
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) handleLoadServiceFromCatalog(Number(val));
                        }}
                        className="p-1 px-2.5 text-[11px] bg-black/60 border border-white/10 rounded-md text-white font-mono w-full"
                      >
                        <option value="">Selección rápida de catálogo...</option>
                        {serviciosCatalogo.map((s, idx) => (
                          <option key={idx} value={idx}>
                            {s.nombre} — ${s.monto} ({FREQ_LABELS[s.freq]})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Servicio Prestado</label>
                    <input
                      type="text"
                      placeholder="Ej. Monitoreo de Alarma, GPS Rastreo"
                      value={fServicio}
                      onChange={(e) => setFServicio(e.target.value)}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Equipo en Comodato / Detalle</label>
                    <input
                      type="text"
                      placeholder="Ej. Panel Neo, Gps 2.0"
                      value={fDesc}
                      onChange={(e) => setFDesc(e.target.value)}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Frecuencia de Cobro</label>
                    <select
                      value={fFreq}
                      onChange={(e) => {
                        const newFreq = e.target.value as any;
                        setFFreq(newFreq);
                        const baseDate = fInicio || todayStr();
                        setFProx(addPeriodo(baseDate, newFreq));
                      }}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white"
                    >
                      <option value="mensual">Mensual</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field">
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Importe ($ MXN)</label>
                      <input
                        type="number"
                        placeholder="Monto"
                        value={fMonto || ""}
                        onChange={(e) => setFMonto(Number(e.target.value))}
                        className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white font-mono"
                      />
                    </div>
                    <div className="field">
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Dto %</label>
                      <input
                        type="number"
                        placeholder="Descuento %"
                        value={fDescuento || ""}
                        onChange={(e) => setFDescuento(Number(e.target.value))}
                        className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white font-mono"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 pt-2 text-[#22c55e] font-mono font-bold text-right text-xs pr-2">
                    Total a Cobrar Periodo: ${Math.round(fMonto * (1 - fDescuento / 100)).toLocaleString()} MXN
                  </div>

                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block col-start-1">Inicio de Contrato</label>
                    <input
                      type="date"
                      value={fInicio}
                      onChange={(e) => {
                        const newInicio = e.target.value;
                        setFInicio(newInicio);
                        if (newInicio && fFreq) {
                          setFProx(addPeriodo(newInicio, fFreq));
                        }
                      }}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block col-start-2">Próximo Cobro Programado</label>
                    <input
                      type="date"
                      value={fProx}
                      onChange={(e) => setFProx(e.target.value)}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="field">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Notas de Cuenta / Observaciones Generales</label>
                <textarea
                  rows={2}
                  value={fNotas}
                  onChange={(e) => setFNotas(e.target.value)}
                  placeholder="Por ejemplo: método de pago preferido, clave del cerco, teléfonos secundarios..."
                  className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white w-full"
                ></textarea>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/5 bg-black/20 flex items-center justify-between">
              <div>
                {editingClient && (
                  <button
                    onClick={() => setClientToDelete(editingClient)}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-semibold flex items-center gap-1 active:scale-95 transition"
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar Registro
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveClientModal}
                  className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-1 active:scale-95 transition"
                >
                  <Check className="w-4 h-4" /> Guardar Cambios
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL WINDOW 2: GLOBAL SETTINGS PANEL */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Configuración del Sistema Detektor</h3>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Settings Tab headers */}
            <div className="flex bg-black/40 p-1 border-b border-white/5">
              <button
                onClick={() => setConfigModalTab("empresa")}
                className={`flex-1 py-2 text-xs font-semibold ${configModalTab === "empresa" ? "bg-white/5 text-white border-b-2 border-indigo-500" : "text-slate-400"}`}
              >
                🏢 Configuración de la Empresa
              </button>
              <button
                onClick={() => setConfigModalTab("db")}
                className={`flex-1 py-2 text-xs font-semibold ${configModalTab === "db" ? "bg-white/5 text-white border-b-2 border-indigo-500" : "text-slate-400"}`}
              >
                📁 Respaldos y Servicios
              </button>
            </div>

            {/* Inner Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              {configModalTab === "empresa" && (
                <div className="space-y-4">
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block col-start-1">Razón Social de la Empresa</label>
                    <input
                      type="text"
                      value={empresa.nombre}
                      onChange={(e) => setEmpresa({ ...empresa, nombre: e.target.value })}
                      placeholder="Ej. Detektor S.A. de C.V."
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white col-span-2 w-full"
                    />
                  </div>
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Dirección Comercial Principal</label>
                    <input
                      type="text"
                      value={empresa.dir}
                      onChange={(e) => setEmpresa({ ...empresa, dir: e.target.value })}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white w-full"
                    />
                  </div>
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Cédula de Identificación Fiscal (RFC)</label>
                    <input
                      type="text"
                      value={empresa.rfc}
                      onChange={(e) => setEmpresa({ ...empresa, rfc: e.target.value })}
                      className="p-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white font-mono uppercase w-full"
                    />
                  </div>
                  <div className="field">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Logotipo Base64 / URL de Imagen</label>
                    <input
                      type="text"
                      value={empresa.logo}
                      onChange={(e) => setEmpresa({ ...empresa, logo: e.target.value })}
                      placeholder="data:image/png;base64,..."
                      className="p-1 px-2.5 text-[10px] bg-black/50 border border-white/10 rounded-lg text-white font-mono w-full"
                    />
                    <span className="text-[9px] text-slate-500 mt-1 block">Soporta data uris para que se imprima directamente en los tickets.</span>
                  </div>
                </div>
              )}

              {configModalTab === "db" && (
                <div className="space-y-4">
                  {/* Service Catalog Builder inside setting drawer */}
                  <div className="p-4 bg-black/40 border border-white/5 rounded-xl space-y-3">
                    <span className="text-[10px] font-extrabold text-indigo-400 block uppercase tracking-wider">Registrar Servicio Predefinido en Catálogo</span>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="field col-span-2">
                        <label className="text-[9px] font-bold text-slate-400 mb-1 block">Nombre de Servicio</label>
                        <input
                          type="text"
                          placeholder="Ej. Monitoreo de Alarma Residencial"
                          value={fcNombre}
                          onChange={(e) => setFcNombre(e.target.value)}
                          className="p-1 px-2 text-xs bg-black/80 border border-white/10 rounded-md text-white w-full"
                        />
                      </div>
                      <div className="field col-span-2">
                        <label className="text-[9px] font-bold text-slate-400 mb-1 block">Descripción del Equipo asignable</label>
                        <input
                          type="text"
                          placeholder="Ej. Comunicador GPRS"
                          value={fcDesc}
                          onChange={(e) => setFcDesc(e.target.value)}
                          className="p-1 px-2 text-xs bg-black/80 border border-white/10 rounded-md text-white w-full"
                        />
                      </div>
                      <div className="field">
                        <label className="text-[9px] font-bold text-slate-400 mb-1 block">Frecuencia</label>
                        <select
                          value={fcFreq}
                          onChange={(e) => setFcFreq(e.target.value as any)}
                          className="p-1 text-xs bg-black/80 border border-white/10 rounded-md text-white w-full font-mono"
                        >
                          <option value="mensual">Mensual</option>
                          <option value="trimestral">Trimestral</option>
                          <option value="semestral">Semestral</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                      <div className="field">
                        <label className="text-[9px] font-bold text-slate-400 mb-1 block">Importe Recurrente ($)</label>
                        <input
                          type="number"
                          placeholder="Importe"
                          value={fcMonto || ""}
                          onChange={(e) => setFcMonto(Number(e.target.value))}
                          className="p-1 text-xs bg-black/80 border border-white/10 rounded-md text-white font-mono w-full"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleAddServiceToCatalog}
                      className="w-full py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded font-bold text-xs shadow"
                    >
                      Registrar en Catálogo
                    </button>

                    {/* Catalog list table rendering within drawer */}
                    {serviciosCatalogo.length > 0 && (
                      <div className="max-h-[140px] overflow-y-auto border border-white/5 rounded-lg mt-2 bg-black/60 scrollbar-thin">
                        <table className="w-full text-left text-[10px]">
                          <thead className="bg-[#1e1e24] text-slate-400">
                            <tr>
                              <th className="p-1.5">Servicio</th>
                              <th className="p-1.5">Freq</th>
                              <th className="p-1.5 text-right">Monto</th>
                              <th className="p-1.5 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {serviciosCatalogo.map((s, idx) => (
                              <tr key={idx} className="hover:bg-white/5">
                                <td className="p-1.5 font-bold text-white">{s.nombre}</td>
                                <td className="p-1.5 uppercase font-mono">{s.freq.slice(0, 3)}</td>
                                <td className="p-1.5 text-right font-mono text-green-400">${s.monto}</td>
                                <td className="p-1.5 text-center">
                                  <button
                                    onClick={() => handleRemoveServiceFromCatalog(idx)}
                                    className="text-red-400 hover:text-red-500 font-bold px-1.5"
                                  >
                                    Eliminar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Restorations and backups */}
                  <div className="bg-black/20 p-4 border border-white/5 rounded-xl space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Copia de Seguridad Completa (Respaldar Todo)</span>
                    <p className="text-[10px] text-slate-500">Descarga un respaldo completo que incluye configuración de empresa, servicios preferenciales, catálogo de clientes e historiales de liquidación.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleExportJSONData}
                        className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition"
                      >
                        <Download className="w-4 h-4" /> Respaldar Todo (JSON)
                      </button>
                      <button
                        onClick={() => document.getElementById("json-file-restorer")?.click()}
                        className="flex-1 py-2 bg-[#1c1c24] hover:bg-white/10 text-white rounded font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition"
                      >
                        <RefreshCw className="w-4 h-4" /> Restaurar Todo (JSON)
                      </button>
                    </div>
                    <input
                      type="file"
                      id="json-file-restorer"
                      accept=".json"
                      className="hidden"
                      onChange={handleImportJSONData}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-black/20 flex gap-2 justify-end">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg font-semibold"
              >
                Cerrar
              </button>
              <button
                onClick={handleSaveSettingsModal}
                className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Guardar Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WINDOW 3: DETECTOR TICKET PRINTER DIALOG */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/10 rounded-2xl w-full max-w-sm flex flex-col scale-100 shadow-2xl animate-in fade-in duration-200 max-h-[92vh]">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-indigo-400" /> Previsualización de Comprobante
              </span>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date selection control (if printing client receipt) */}
            {activeReceiptClient && (
              <div className="p-3 bg-[#16161a] border-b border-white/5 space-y-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Seleccionar Fecha del Recibo:
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {/* Select from existing registered payments */}
                    <div>
                      <span className="text-[9px] text-slate-500 block mb-0.5">Historial de pagos:</span>
                      <select
                        value={activeReceiptSelectedFecha}
                        onChange={(e) => setActiveReceiptSelectedFecha(e.target.value)}
                        className="w-full bg-black/40 text-slate-200 text-xs p-1.5 rounded-lg border border-white/10 focus:outline-none focus:border-indigo-500/50"
                      >
                        <option value="">-- Último pago registrado --</option>
                        {(activeReceiptClient.pagos || []).slice().reverse().map((p, pIdx) => (
                          <option key={pIdx} value={p.fecha}>
                            {fmtDate(p.fecha)} - ${p.monto.toLocaleString("es-MX")}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date picker for custom/arbitrary dates */}
                    <div>
                      <span className="text-[9px] text-slate-500 block mb-0.5">Fecha libre:</span>
                      <input
                        type="date"
                        value={activeReceiptSelectedFecha}
                        onChange={(e) => setActiveReceiptSelectedFecha(e.target.value)}
                        className="w-full bg-black/40 text-slate-200 text-xs p-1.5 rounded-lg border border-white/10 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Info status block */}
                <div className="text-[10px] pt-1">
                  {(() => {
                    const match = (activeReceiptClient.pagos || []).find((p) => p.fecha === activeReceiptSelectedFecha);
                    if (activeReceiptSelectedFecha) {
                      if (match) {
                        return (
                          <span className="text-green-400 font-medium flex items-center gap-1">
                            ✓ Pago de {match.recibo} encontrado para {fmtDate(match.fecha)} (${match.monto.toLocaleString("es-MX")})
                          </span>
                        );
                      } else {
                        return (
                          <span className="text-amber-400 font-medium">
                            ℹ No hay pago registrado en esta fecha. Se usará como fecha del recibo.
                          </span>
                        );
                      }
                    } else {
                      const latestPago = (activeReceiptClient.pagos || []).slice(-1)[0];
                      if (latestPago) {
                        return (
                          <span className="text-indigo-400 font-medium">
                            ℹ Mostrando el pago más reciente registrado ({fmtDate(latestPago.fecha)} - {latestPago.recibo}).
                          </span>
                        );
                      }
                      return (
                        <span className="text-slate-400 font-medium">
                          ℹ El cliente no tiene pagos registrados.
                        </span>
                      );
                    }
                  })()}
                </div>
              </div>
            )}

            {/* Body displaying thermal output ticket natively */}
            <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-black/40">
              <div id="receipt-ticket-print-panel" className="bg-white p-6 text-black" style={{ width: "75mm", minHeight: "100mm" }}>
                <ReceiptTicket
                  cliente={activeReceiptClient || undefined}
                  recibo={activeCustomReceipt}
                  selectedFecha={activeReceiptSelectedFecha}
                  empresa={empresa}
                />
              </div>
            </div>

            {/* Print and share capabilities */}
            <div className="p-4 border-t border-white/5 bg-black/20 grid grid-cols-3 gap-2">
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded font-bold text-xs"
              >
                Cerrar
              </button>
              <button
                onClick={handleShareReceiptOnWhatsApp}
                className="py-2 bg-[#25d366]/10 border border-[#25d366]/20 text-[#25d366] hover:bg-[#25d366]/20 rounded font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all text-center"
              >
                <Share2 className="w-3.5 h-3.5" /> PDF / WA
              </button>
              <button
                onClick={handlePrintSilentTicket}
                className="py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION OVERLAY: QUICK REGISTER PAYMENT MODAL */}
      {paymentToConfirm && (
        <div id="payment-confirm-modal" className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn duration-200">
          <div className="bg-[#121216] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" /> Registrar Cobro de Servicio
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Estás registrando el cobro del próximo período para este cliente de contrato.
            </p>

            <div className="bg-[#1a1a20] rounded-xl p-4 border border-white/5 space-y-2.5 mb-4 text-xs">
              <div className="flex justify-between pb-1.5 border-b border-white/5">
                <span className="text-slate-400">Cliente</span>
                <span className="font-bold text-white">{paymentToConfirm.nombre}</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-white/5">
                <span className="text-slate-400">Cuenta de Contrato</span>
                <span className="font-mono font-bold text-indigo-400">{paymentToConfirm.cuenta}</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-white/5">
                <span className="text-slate-400">Servicio</span>
                <span className="font-semibold text-white">{paymentToConfirm.servicio || "Monitoreo"}</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-white/5">
                <span className="text-slate-400">Importe a Cobrar</span>
                <span className="font-mono font-bold text-green-400 text-sm">
                  ${montoFinal(paymentToConfirm).toLocaleString()} MXN
                </span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-white/5">
                <span className="text-slate-400">Período que Cubre</span>
                <span className="font-semibold text-indigo-300">
                  {(() => {
                    const fechaPago = todayStr();
                    const pDesde = paymentToConfirm.proximoCobro || fechaPago;
                    const infoPeriodo = periodoCubierto(pDesde, paymentToConfirm.freq);
                    return `${fmtDate(infoPeriodo.desde)} al ${fmtDate(infoPeriodo.hasta)}`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Próxima fecha de cobro</span>
                <span className="font-mono font-semibold text-yellow-500">
                  {fmtDate(addPeriodo(paymentToConfirm.proximoCobro || todayStr(), paymentToConfirm.freq))}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-wider">
                Método de Pago
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["Transferencia", "Efectivo", "Tarjeta"].map((metodo) => (
                  <button
                    key={metodo}
                    type="button"
                    onClick={() => setConfirmMetodoPago(metodo)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      confirmMetodoPago === metodo
                        ? "bg-indigo-500/15 border-indigo-500 text-indigo-300 shadow-md animate-pulse"
                        : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {metodo === "Efectivo" ? "💵 Efectivo" : metodo === "Transferencia" ? "🏦 Transf." : "💳 Tarjeta"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPaymentToConfirm(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg font-semibold text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmPayment(paymentToConfirm, confirmMetodoPago)}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition shadow-lg shadow-green-900/10"
              >
                <Check className="w-3.5 h-3.5" /> Registrar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION OVERLAY: SAFE DELETE CLIENT WARNING MODAL */}
      {clientToDelete && (
        <div id="delete-confirm-modal" className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-fadeIn duration-200">
          <div className="bg-[#121216] border border-red-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 animate-bounce" /> Eliminar Cliente de Contrato
            </h3>
            <p className="text-xs text-slate-300 mb-4 bg-red-500/5 border border-red-500/10 p-3 rounded-lg leading-relaxed">
              ¿Seguro que deseas eliminar definitivamente a <strong>{clientToDelete.nombre}</strong> (Cuenta: <strong>{clientToDelete.cuenta}</strong>)? 
              <span className="block mt-1 font-semibold text-red-400">¡Esta acción es irreversible y se borrarán todos sus historiales de pago!</span>
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg font-semibold text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteClientConfirmed}
                className="px-4 py-2 bg-red-650 hover:bg-red-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION OVERLAY: DATABASE RESTORE SUMMARY MODAL */}
      {backupRestoreData && (
        <div id="restore-confirm-modal" className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn duration-200">
          <div className="bg-[#121216] border border-indigo-500/20 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-400" /> Restaurar Copia de Seguridad
            </h3>
            <p className="text-xs text-slate-300 mb-4 bg-indigo-500/5 border border-indigo-500/15 p-3 rounded-lg leading-relaxed">
              Confirmar restauración de respaldo. Se reemplazará permanentemente la información local y en la base de datos de los siguientes módulos:
            </p>

            <div className="bg-[#1a1a20] rounded-xl p-4 border border-white/5 space-y-3 mb-4 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Clientes de Contrato</span>
                <span className="font-bold text-indigo-400">{backupRestoreData.clientes?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recibos Emitidos</span>
                <span className="font-bold text-indigo-400">{backupRestoreData.recibos?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Servicios en Catálogo</span>
                <span className="font-bold text-indigo-400">{backupRestoreData.serviciosCatalogo?.length || 0}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setBackupRestoreData(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg font-semibold text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBackupRestore}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition"
              >
                <Check className="w-3.5 h-3.5" /> Restaurar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
