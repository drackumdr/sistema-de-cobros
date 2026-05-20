export interface Pago {
  id?: string;
  fecha: string;
  monto: number;
  recibo: string;
  periodoDesde: string;
  periodoHasta: string;
  metodoPago?: string;
  tenantId?: string;
}

export interface Contacto {
  id?: string;
  nombre: string;
  cel: string;
}

export interface Cliente {
  id: string;
  cuenta: string;
  nombre: string;
  tel?: string;
  contactoNombre?: string;
  contactoCel?: string;
  contactos?: Contacto[];
  email?: string;
  rfc?: string;
  dir?: string;
  freq: "mensual" | "trimestral" | "semestral" | "anual";
  monto: number;
  descuento: number;
  servicio?: string;
  desc?: string;
  inicio?: string;
  proximoCobro: string;
  notas?: string;
  estado: "activo" | "suspendido" | "cancelado";
  pagos: Pago[];
}

export interface ItemReciboPersonalizado {
  tipo: "servicio" | "producto";
  nombre: string;
  monto: number;
  cantidad: number;
  descuento?: number; // %
}

export interface ReciboPersonalizado {
  id: string;
  numeroRecibo: string;
  fecha: string;
  clienteId?: string; // Si se asocia a un cliente existente
  clienteNombre: string;
  clienteTel?: string;
  clienteRfc?: string;
  clienteDir?: string;
  items: ItemReciboPersonalizado[];
  subtotal: number;
  ivaPercent?: number; // % (ej. 16)
  total: number;
  metodoPago: "efectivo" | "transferencia" | "tarjeta" | "otro";
  notas?: string;
}

export interface EmpresaData {
  nombre: string;
  rfc: string;
  dir: string;
  logo: string;
}

export interface ServicioPredefinido {
  nombre: string;
  desc: string;
  freq: "mensual" | "trimestral" | "semestral" | "anual";
  monto: number;
}
