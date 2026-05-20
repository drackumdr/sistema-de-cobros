import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const FALLBACK_FILE = path.resolve("db_local_fallback.json");

// Define schema interfaces
export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
  tenantId?: string;
}

export interface Pago {
  id?: string;
  fecha: string;
  monto: number;
  recibo: string;
  periodoDesde: string;
  periodoHasta: string;
  clienteId?: string;
  clienteNombre?: string;
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
  tenantId?: string;
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
  clienteId?: string; // Si está enlazado a cliente
  clienteNombre: string; // Para clientes libres o manuales
  clienteTel?: string;
  clienteRfc?: string;
  clienteDir?: string;
  items: ItemReciboPersonalizado[];
  subtotal: number;
  descuentoGlobal?: number; // %
  ivaPercent?: number; //% (e.g. 16 for 16% IVA)
  total: number;
  metodoPago: "efectivo" | "transferencia" | "tarjeta" | "otro";
  notas?: string;
  tenantId?: string;
}

export interface DetektorConfig {
  key: string;
  value: any;
  tenantId?: string;
}

// Lazy initialization of DynamoDB helper
let dynamoDbClient: DynamoDBClient | null = null;
let docClient: DynamoDBDocumentClient | null = null;
let useLocalFallback = true;
let awsConnectionError: string | null = null;

const TABLE_CLIENTES = "ThunderShieldBackend-Clients";
const TABLE_CONTACTOS = "ThunderShieldBackend-ClientContacts";
const TABLE_SECURITY = "ThunderShieldBackend-SecurityTable";
const TABLE_CONFIG = "detektor_config";
const TABLE_RECIBOS = "detektor_recibos";
const TABLE_PAGOS = "detektor_pagos";

function initDynamoClient(): DynamoDBDocumentClient {
  if (docClient) return docClient;

  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!accessKey || !secretKey) {
    useLocalFallback = true;
    awsConnectionError = "AWS credentials missing in environment (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)";
    return {} as any;
  }

  try {
    dynamoDbClient = new DynamoDBClient({
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
    docClient = DynamoDBDocumentClient.from(dynamoDbClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true,
      },
    });
    useLocalFallback = false;
    awsConnectionError = null;
    console.log("⚡ Static AWS DynamoDB Client configured correctly.");
    return docClient;
  } catch (error: any) {
    useLocalFallback = true;
    awsConnectionError = error.message || "Failed to initialize DynamoDBClient";
    console.error("❌ Error initializing DynamoDBClient:", error);
    return {} as any;
  }
}

// Dynamic Client Provider incorporating temporary AWS security tokens
export function getDynamoDocClient(credentials?: AWSCredentials): DynamoDBDocumentClient | null {
  if (credentials && credentials.accessKeyId && credentials.secretAccessKey) {
    try {
      const client = new DynamoDBClient({
        region: credentials.region || process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      });
      return DynamoDBDocumentClient.from(client, {
        marshallOptions: {
          removeUndefinedValues: true,
          convertEmptyValues: true,
        },
      });
    } catch (e: any) {
      console.error("❌ Error initializing dynamic custom DynamoDB client:", e);
    }
  }

  initDynamoClient();
  if (useLocalFallback || !docClient || !Object.keys(docClient).length) {
    return null;
  }
  return docClient;
}

// Helper to partition configuration keys per tenant
const getPartitionedKey = (key: string, tenantId?: string) => {
  return tenantId ? `${tenantId}_${key}` : key;
};

// Ensure the local fallback DB exists
function ensureLocalDbFile() {
  if (!fs.existsSync(FALLBACK_FILE)) {
    const defaultData = {
      clientes: [
        {
          id: "demo-cliente-1",
          cuenta: "SEC-1001",
          nombre: "Juan Pérez García (Demo)",
          tel: "6141234567",
          contactoNombre: "Juan Pérez García",
          contactoCel: "6141234567",
          email: "juan.perez@ejemplo.com",
          rfc: "PEGJ800101XXX",
          dir: "Av. de las Industrias #1230, Chihuahua, Chih.",
          freq: "mensual" as const,
          monto: 350,
          descuento: 0,
          servicio: "Monitoreo de Alarma Residencial",
          desc: "Panel DSC Neo y Sensor de Apertura",
          inicio: "2026-01-10",
          proximoCobro: "2026-06-10",
          notas: "Pagar con transferencia bancaria los primeros 10 días.",
          estado: "activo" as const,
          pagos: [
            {
              id: "demo-pago-1",
              fecha: "2026-05-10",
              monto: 350,
              recibo: "REC-948210",
              periodoDesde: "2026-05-10",
              periodoHasta: "2026-06-09"
            }
          ]
        },
        {
          id: "demo-cliente-2",
          cuenta: "SEC-1002",
          nombre: "Corporativo Detektor (Demo)",
          tel: "6149876543",
          contactoNombre: "Soporte Central",
          contactoCel: "6149876543",
          email: "corporativo@detektor.mx",
          rfc: "DET123456XX0",
          dir: "Periférico de la Juventud #4400, Plaza Sphera",
          freq: "anual" as const,
          monto: 1500,
          descuento: 10,
          servicio: "Localización GPS Monitoreada",
          desc: "2x Dispositivos GPS Vehicular con corte de motor",
          inicio: "2025-05-20",
          proximoCobro: "2026-05-20",
          notas: "Requiere factura electrónica con IVA desglosado.",
          estado: "activo" as const,
          pagos: []
        }
      ],
      config: [
        {
          key: "empresa",
          value: {
            nombre: "Detektor Seguridad Profesional",
            rfc: "DET123456XX0",
            dir: "Periférico de la Juventud #4400, Chihuahua, CP 31120",
            logo: ""
          }
        },
        {
          key: "servicios",
          value: [
            { nombre: "Monitoreo de Alarma Residencial", desc: "Monitoreo 24/7 GPRS/IP", freq: "mensual", monto: 300 },
            { nombre: "Monitoreo de Alarma Residencial con Comodato", desc: "Incluye modulo WiFi", freq: "mensual", monto: 350 },
            { nombre: "Localización Gps Vehicular", desc: "Plataforma de rastreo premium", freq: "mensual", monto: 180 },
            { nombre: "Mantenimiento Técnico Preventivo", desc: "Limpieza y cambio de baterias anual", freq: "anual", monto: 850 }
          ]
        },
        {
          key: "seq",
          value: 1002
        }
      ],
      recibos: [
        {
          id: "demo-recibo-1",
          numeroRecibo: "RECP-0001",
          fecha: "2026-05-20",
          clienteNombre: "Juan Pérez García",
          clienteTel: "6141234567",
          items: [
            { tipo: "producto", nombre: "Sensor Infrarrojo de Movimiento Premium", monto: 450, cantidad: 2 },
            { tipo: "servicio", nombre: "Instalación y Configuración Técnica", monto: 300, cantidad: 1 }
          ],
          subtotal: 1200,
          descuentoGlobal: 0,
          ivaPercent: 16,
          total: 1392,
          metodoPago: "efectivo",
          notas: "Venta directa de equipo al cliente."
        }
      ],
      pagos: [
        {
          id: "demo-pago-1",
          clienteId: "demo-cliente-1",
          clienteNombre: "Juan Pérez García (Demo)",
          fecha: "2026-05-10",
          monto: 350,
          recibo: "REC-948210",
          periodoDesde: "2026-05-10",
          periodoHasta: "2026-06-09"
        }
      ]
    };
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(defaultData, null, 2), "utf-8");
  }
}

// Helper to read local json backup
function readLocalDb(): { clientes: Cliente[]; config: DetektorConfig[]; recibos: ReciboPersonalizado[]; pagos: Pago[] } {
  ensureLocalDbFile();
  try {
    const raw = fs.readFileSync(FALLBACK_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.pagos) parsed.pagos = [];
    return parsed;
  } catch (error) {
    console.error("Error reading local database fallback file:", error);
    return { clientes: [], config: [], recibos: [], pagos: [] };
  }
}

// Helper to write local json
function writeLocalDb(data: { clientes: Cliente[]; config: DetektorConfig[]; recibos: ReciboPersonalizado[]; pagos: Pago[] }) {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing to local database fallback file:", error);
  }
}

// Dynamo Table creation routines
async function executeSetup(dClient: DynamoDBClient): Promise<{ success: boolean; mode: "dynamo" | "local" }> {
  const listResponse = await dClient.send(new ListTablesCommand({}));
  const existingTables = listResponse.TableNames || [];

  const createTableHelper = async (tableName: string, keyName: string) => {
    if (existingTables.includes(tableName)) return;

    console.log(`🔨 Table ${tableName} does not exist in DynamoDB. Creating...`);
    await dClient.send(
      new CreateTableCommand({
        TableName: tableName,
        AttributeDefinitions: [{ AttributeName: keyName, AttributeType: "S" }],
        KeySchema: [{ AttributeName: keyName, KeyType: "HASH" }],
        BillingMode: "PAY_PER_REQUEST",
      })
    );
    console.log(`✅ Table ${tableName} successfully created in DynamoDB.`);
  };

  // Create supplementary app tables only if missing
  await createTableHelper(TABLE_CONFIG, "key");
  await createTableHelper(TABLE_RECIBOS, "id");
  await createTableHelper(TABLE_PAGOS, "id");

  return { success: true, mode: "dynamo" };
}

export async function setupTablesIfMissing(credentials?: AWSCredentials): Promise<{ success: boolean; mode: "dynamo" | "local"; error?: string }> {
  // Use either custom temporary credentials or general static credentials
  let dClient: DynamoDBClient | null = null;
  let usingDynamic = false;
  
  if (credentials && credentials.accessKeyId && credentials.secretAccessKey) {
    try {
      dClient = new DynamoDBClient({
        region: credentials.region || "us-east-1",
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      });
      usingDynamic = true;
    } catch (e: any) {
      console.warn("Could not initial dynamic DynamoDB client for setup:", e.message);
    }
  }

  if (!dClient) {
    initDynamoClient();
    if (useLocalFallback || !dynamoDbClient) {
      ensureLocalDbFile();
      return { success: true, mode: "local", error: awsConnectionError || "Running in local fallback mode" };
    }
    dClient = dynamoDbClient;
  }

  try {
    return await executeSetup(dClient);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && usingDynamic) {
      console.warn("⚠️ Temp credentials expired/invalid for setup. Retrying setup using static system credentials...");
      initDynamoClient();
      if (dynamoDbClient) {
        try {
          return await executeSetup(dynamoDbClient);
        } catch (retryError: any) {
          console.error("❌ Retry setup with static credentials failed:", retryError);
        }
      }
    }
    console.error("❌ Failed to setup tables or contact DynamoDB. Using local storage mode.", error);
    ensureLocalDbFile();
    return { success: true, mode: "local", error: error.message };
  }
}

// Helper to calculate the next sequential clientId for new accounts
async function getNextClientId(customDocClient: any, tenantId: string): Promise<number> {
  try {
    const res = await customDocClient.send(new ScanCommand({
      TableName: TABLE_CLIENTES,
      FilterExpression: "tenantId = :tenantId",
      ExpressionAttributeValues: { ":tenantId": tenantId },
      ProjectionExpression: "clientId"
    }));
    const items = res.Items || [];
    const ids = items.map((i: any) => Number(i.clientId) || 0);
    return ids.length > 0 ? Math.max(...ids) + 1 : 1001;
  } catch (e) {
    console.warn("⚠️ Failed to scan for next clientId, defaulting to current TS:", e);
    return Math.floor(Date.now() / 1000);
  }
}

// Core Database Methods: Clientes
async function executeGetClientes(customDocClient: any, tenantId: string, credentials?: any): Promise<Cliente[]> {
  // 1. Fetch clients for this tenant
  const clientParams: any = { TableName: TABLE_CLIENTES };
  if (tenantId) {
    clientParams.FilterExpression = "tenantId = :tenantId";
    clientParams.ExpressionAttributeValues = {
      ":tenantId": tenantId,
    };
  }
  const clientRes = await customDocClient.send(new ScanCommand(clientParams));
  const rawClients = clientRes.Items || [];

  // 2. Fetch contacts for this tenant
  const contactParams: any = { TableName: TABLE_CONTACTOS };
  if (tenantId) {
    contactParams.FilterExpression = "tenantId = :tenantId";
    contactParams.ExpressionAttributeValues = {
      ":tenantId": tenantId,
    };
  }
  let rawContacts: any[] = [];
  try {
    const contactRes = await customDocClient.send(new ScanCommand(contactParams));
    rawContacts = contactRes.Items || [];
  } catch (e: any) {
    console.warn("⚠️ Scan ThunderShieldBackend-ClientContacts failed:", e.message);
  }

  // 3. Fetch payments
  const payments = await getPagos(credentials);

  // 4. Map client items to schema
  const mappedClients: Cliente[] = rawClients.map((item: any) => {
    const cIdStr = String(item.clientId);
    const matchingContacts = rawContacts.filter(c => Number(c.clientId) === item.clientId);
    const mainContact = matchingContacts[0];
    const clientPayments = payments.filter(p => p.clienteId === cIdStr);

    return {
      id: cIdStr,
      cuenta: item.accountNumber || "0000",
      nombre: item.businessName || item.managerName || "Sin Nombre",
      tel: item.phoneNumber || "",
      contactoNombre: mainContact ? (mainContact.contactName || "").trim() : "",
      contactoCel: mainContact ? (mainContact.contactPhone || "").trim() : "",
      contactos: matchingContacts.map(c => ({
        id: c.contactId,
        nombre: (c.contactName || "").trim(),
        cel: (c.contactPhone || "").trim()
      })),
      email: item.email || "",
      rfc: item.rfc || "",
      dir: item.address || item.city || "",
      freq: item.freq || "mensual",
      monto: typeof item.monto === "number" ? item.monto : 0,
      descuento: typeof item.descuento === "number" ? item.descuento : 0,
      servicio: item.servicio || "",
      desc: item.desc || "",
      inicio: item.inicio || "",
      proximoCobro: item.proximoCobro || "",
      notas: item.notes || item.notas || "",
      estado: item.estado || "activo",
      pagos: clientPayments,
      tenantId: item.tenantId
    };
  });

  return mappedClients;
}

export async function getClientes(credentials?: AWSCredentials): Promise<Cliente[]> {
  let customDocClient = getDynamoDocClient(credentials);
  const tenantId = credentials?.tenantId || "";

  if (!customDocClient) {
    const local = readLocalDb().clientes;
    if (tenantId) {
      return local.filter(c => c.tenantId === tenantId);
    }
    return local;
  }

  try {
    return await executeGetClientes(customDocClient, tenantId, credentials);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn("⚠️ Temp credentials expired or invalid. Retrying getClientes with static system credentials...");
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeGetClientes(staticDocClient, tenantId, { tenantId });
        } catch (retryError) {
          console.error("❌ Retry with static credentials failed for getClientes:", retryError);
        }
      }
    }
    console.warn("⚠️ Scan ThunderShieldBackend-Clients failed, using local backup. Error:", error);
    const local = readLocalDb().clientes;
    if (tenantId) {
      return local.filter(c => c.tenantId === tenantId);
    }
    return local;
  }
}

async function executeSaveCliente(customDocClient: any, tenantId: string, cliente: Cliente, credentials?: any): Promise<boolean> {
  let numericId = Number(cliente.id);
  let existingItem: any = {};

  if (isNaN(numericId) || numericId <= 0) {
    // Allocate next sequence number
    numericId = await getNextClientId(customDocClient, tenantId);
    cliente.id = String(numericId);
  } else {
    try {
      const fetchRes = await customDocClient.send(new GetCommand({
        TableName: TABLE_CLIENTES,
        Key: { tenantId, clientId: numericId }
      }));
      if (fetchRes.Item) {
        existingItem = fetchRes.Item;
      }
    } catch (getErr: any) {
      const isSecErr = getErr.name === "UnrecognizedClientException" || getErr.message?.includes("security token") || getErr.message?.includes("expired");
      if (isSecErr) {
        throw getErr;
      }
      console.warn("⚠️ Get client failed before save, using merge:", getErr.message);
    }
  }

  const itemToSave = {
    ...existingItem,
    tenantId: tenantId,
    clientId: numericId,
    accountNumber: cliente.cuenta || existingItem.accountNumber || "0000",
    businessName: cliente.nombre || existingItem.businessName || "",
    managerName: cliente.nombre || existingItem.managerName || "",
    phoneNumber: cliente.tel || existingItem.phoneNumber || "",
    email: cliente.email || existingItem.email || "",
    rfc: cliente.rfc || existingItem.rfc || "",
    address: cliente.dir || existingItem.address || "",
    freq: cliente.freq || "mensual",
    monto: Number(cliente.monto) || 0,
    descuento: Number(cliente.descuento) || 0,
    servicio: cliente.servicio || "",
    desc: cliente.desc || "",
    inicio: cliente.inicio || "",
    proximoCobro: cliente.proximoCobro || "",
    notas: cliente.notas || "",
    estado: cliente.estado || "activo",
    lastSyncedAt: Date.now(),
    updatedAt: new Date().toISOString()
  };

  delete itemToSave.pagos;

  await customDocClient.send(
    new PutCommand({
      TableName: TABLE_CLIENTES,
      Item: itemToSave,
    })
  );

  // Save corresponding contacts
  try {
    let finalContactos: Array<{ nombre: string; cel: string }> = [];
    if (cliente.contactos && Array.isArray(cliente.contactos)) {
      finalContactos = cliente.contactos.map(c => ({
        nombre: (c.nombre || "").trim(),
        cel: (c.cel || "").trim()
      }));
    } else if (cliente.contactoNombre || cliente.contactoCel) {
      finalContactos = [{
        nombre: (cliente.contactoNombre || "").trim(),
        cel: (cliente.contactoCel || "").trim()
      }];
    }

    const contactScan = await customDocClient.send(new ScanCommand({
      TableName: TABLE_CONTACTOS,
      FilterExpression: "tenantId = :tenantId AND clientId = :clientId",
      ExpressionAttributeValues: {
        ":tenantId": tenantId,
        ":clientId": numericId
      }
    }));
    const existingInDb = contactScan.Items || [];

    // Save and overwrite up to finalContactos length
    for (let idx = 0; idx < finalContactos.length; idx++) {
      const c = finalContactos[idx];
      const contactId = `${numericId}#${idx + 1}`;
      const existingMatch = existingInDb.find(item => item.contactId === contactId) || {};
      
      const contactToSave = {
        ...existingMatch,
        tenantId: tenantId,
        contactId: contactId,
        clientId: numericId,
        contactName: c.nombre,
        contactPhone: c.cel,
        lastSyncedAt: Date.now()
      };

      await customDocClient.send(new PutCommand({
        TableName: TABLE_CONTACTOS,
        Item: contactToSave
      }));
    }

    // Delete excess contacts
    const newCount = finalContactos.length;
    const excess = existingInDb.filter(item => {
      const parts = item.contactId.split("#");
      const numSuffix = Number(parts[parts.length - 1]);
      return !isNaN(numSuffix) && numSuffix > newCount;
    });

    for (const item of excess) {
      await customDocClient.send(new DeleteCommand({
        TableName: TABLE_CONTACTOS,
        Key: {
          tenantId: tenantId,
          contactId: item.contactId
        }
      }));
    }
  } catch (contactErr: any) {
    console.error("❌ Failed to save corresponding contacts to ClientContacts:", contactErr);
  }

  return true;
}

export async function saveCliente(cliente: Cliente, credentials?: AWSCredentials): Promise<boolean> {
  const customDocClient = getDynamoDocClient(credentials);
  const tenantId = credentials?.tenantId || cliente.tenantId || "";

  if (tenantId) {
    cliente.tenantId = tenantId;
  }

  // 1. Double write payments to tables if client has registered payments
  if (cliente.pagos && Array.isArray(cliente.pagos)) {
    for (const p of cliente.pagos) {
      if (!p.id) p.id = `pago-${p.recibo || String(Date.now())}`;
      const payload: Pago = {
        ...p,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        tenantId: tenantId
      };
      await savePago(payload, credentials);
    }
  }

  if (!customDocClient) {
    const db = readLocalDb();
    const idx = db.clientes.findIndex(c => c.id === cliente.id);
    if (idx >= 0) {
      db.clientes[idx] = cliente;
    } else {
      db.clientes.push(cliente);
    }
    writeLocalDb(db);
    return true;
  }

  try {
    return await executeSaveCliente(customDocClient, tenantId, cliente, credentials);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn("⚠️ Temp credentials expired/invalid for saveCliente. Retrying with static system credentials...");
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeSaveCliente(staticDocClient, tenantId, cliente, { tenantId });
        } catch (retryError) {
          console.error("❌ Retry with static credentials failed for saveCliente:", retryError);
        }
      }
    }
    console.error("❌ DynamoDB saveCliente failed:", error);
    const db = readLocalDb();
    const idx = db.clientes.findIndex(c => c.id === cliente.id);
    if (idx >= 0) db.clientes[idx] = cliente;
    else db.clientes.push(cliente);
    writeLocalDb(db);
    return false;
  }
}

async function executeDeleteCliente(customDocClient: any, tenantId: string, numericId: number): Promise<boolean> {
  await customDocClient.send(
    new DeleteCommand({
      TableName: TABLE_CLIENTES,
      Key: { tenantId, clientId: numericId },
    })
  );

  // Clean up contacts
  try {
    const contactScan = await customDocClient.send(new ScanCommand({
      TableName: TABLE_CONTACTOS,
      FilterExpression: "tenantId = :tenantId AND clientId = :clientId",
      ExpressionAttributeValues: {
        ":tenantId": tenantId,
        ":clientId": numericId
      }
    }));
    if (contactScan.Items) {
      for (const item of contactScan.Items) {
        await customDocClient.send(new DeleteCommand({
          TableName: TABLE_CONTACTOS,
          Key: { tenantId, contactId: item.contactId }
        }));
      }
    }
  } catch (conErr: any) {
    console.warn("⚠️ Failed to delete matching contacts:", conErr.message);
  }

  return true;
}

export async function deleteCliente(id: string, credentials?: AWSCredentials): Promise<boolean> {
  const customDocClient = getDynamoDocClient(credentials);
  const tenantId = credentials?.tenantId || "";

  if (!customDocClient) {
    const db = readLocalDb();
    db.clientes = db.clientes.filter(c => c.id !== id);
    writeLocalDb(db);
    return true;
  }

  const numericId = Number(id);
  if (isNaN(numericId)) {
    return true;
  }

  try {
    return await executeDeleteCliente(customDocClient, tenantId, numericId);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn("⚠️ Temp credentials expired/invalid for deleteCliente. Retrying with static credentials...");
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeDeleteCliente(staticDocClient, tenantId, numericId);
        } catch (retryError) {
          console.error("❌ Retry with static credentials failed for deleteCliente:", retryError);
        }
      }
    }
    console.error("❌ DynamoDB deleteCliente failed:", error);
    const db = readLocalDb();
    db.clientes = db.clientes.filter(c => c.id !== id);
    writeLocalDb(db);
    return false;
  }
}

// Core Database Methods: Config
async function executeGetConfig(customDocClient: any, key: string, partitionedKey: string, credentials?: any): Promise<any> {
  // Integrates company profile with ThunderShieldBackend-SecurityTable if requested key is 'empresa'
  if (key === "empresa" && credentials?.tenantId) {
    try {
      const resSec = await customDocClient.send(
        new GetCommand({
          TableName: TABLE_SECURITY,
          Key: { 
            PK: `TENANT#${credentials.tenantId}`,
            SK: "PROFILE"
          },
        })
      );
      if (resSec.Item) {
        return {
          nombre: resSec.Item.name || "Detektor Alta Tecnologia en Alarmas",
          rfc: resSec.Item.rfc || "DET123456XX0",
          dir: resSec.Item.address || "México",
          logo: resSec.Item.logoUrl || ""
        };
      }
    } catch (e: any) {
      const isSecErr = e.name === "UnrecognizedClientException" || e.message?.includes("security token") || e.message?.includes("expired");
      if (isSecErr) {
        throw e;
      }
      console.warn("⚠️ Failed to load company profile from ThunderShieldBackend-SecurityTable:", e.message);
    }
  }

  try {
    const res = await customDocClient.send(
      new GetCommand({
        TableName: TABLE_CONFIG,
        Key: { key: partitionedKey },
      })
    );
    if (res.Item) {
      return res.Item.value;
    }
  } catch (err: any) {
    // If the error is a security token issue, let it bubble up so retry mechanism handles it
    const isSecurityError = err.name === "UnrecognizedClientException" || err.message?.includes("security token") || err.message?.includes("expired");
    if (isSecurityError) {
      throw err;
    }
  }
  
  // Fallback to un-partitioned default configuration if key doesn't prefix tenant
  const resOrg = await customDocClient.send(
    new GetCommand({
      TableName: TABLE_CONFIG,
      Key: { key },
    })
  );
  return resOrg.Item ? resOrg.Item.value : null;
}

export async function getConfig(key: string, credentials?: AWSCredentials): Promise<any> {
  const customDocClient = getDynamoDocClient(credentials);
  const partitionedKey = getPartitionedKey(key, credentials?.tenantId);

  if (!customDocClient) {
    const db = readLocalDb();
    const item = db.config.find(c => c.key === partitionedKey) || db.config.find(c => c.key === key);
    return item ? item.value : null;
  }

  try {
    return await executeGetConfig(customDocClient, key, partitionedKey, credentials);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn(`⚠️ Temp credentials expired/invalid for getConfig [${key}]. Retrying with static system credentials...`);
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeGetConfig(staticDocClient, key, partitionedKey, { tenantId: credentials.tenantId });
        } catch (retryError) {
          console.error(`❌ Retry getConfig with static credentials failed for [${key}]:`, retryError);
        }
      }
    }
    console.warn(`⚠️ Get config for ${partitionedKey} failed, showing local fallback:`, error);
    const db = readLocalDb();
    const item = db.config.find(c => c.key === partitionedKey) || db.config.find(c => c.key === key);
    return item ? item.value : null;
  }
}

async function executeSaveConfig(customDocClient: any, key: string, partitionedKey: string, value: any, credentials?: any): Promise<boolean> {
  // Integrates profile save to ThunderShieldBackend-SecurityTable if 'empresa'
  if (key === "empresa" && credentials?.tenantId) {
    try {
      let existingProfile: any = {};
      try {
        const fetchSec = await customDocClient.send(new GetCommand({
          TableName: TABLE_SECURITY,
          Key: { 
            PK: `TENANT#${credentials.tenantId}`,
            SK: "PROFILE"
          }
        }));
        if (fetchSec.Item) {
          existingProfile = fetchSec.Item;
        }
      } catch (fErr: any) {
        const isSecErr = fErr.name === "UnrecognizedClientException" || fErr.message?.includes("security token") || fErr.message?.includes("expired");
        if (isSecErr) {
          throw fErr;
        }
        console.warn("⚠️ Failed to retrieve existing profile before update:", fErr);
      }

      await customDocClient.send(
        new PutCommand({
          TableName: TABLE_SECURITY,
          Item: {
            ...existingProfile,
            PK: `TENANT#${credentials.tenantId}`,
            SK: "PROFILE",
            tenantId: credentials.tenantId,
            name: value.nombre || existingProfile.name || "",
            address: value.dir || existingProfile.address || "",
            rfc: value.rfc || existingProfile.rfc || "",
            logoUrl: value.logo || existingProfile.logoUrl || "",
            updatedAt: new Date().toISOString()
          },
        })
      );
    } catch (e: any) {
      const isSecErr = e.name === "UnrecognizedClientException" || e.message?.includes("security token") || e.message?.includes("expired");
      if (isSecErr) {
        throw e;
      }
      console.warn("⚠️ Failed to write company profile to ThunderShieldBackend-SecurityTable:", e.message);
    }
  }

  await customDocClient.send(
    new PutCommand({
      TableName: TABLE_CONFIG,
      Item: { 
        key: partitionedKey, 
        value, 
        tenantId: credentials?.tenantId 
      },
    })
  );
  return true;
}

export async function saveConfig(key: string, value: any, credentials?: AWSCredentials): Promise<boolean> {
  const customDocClient = getDynamoDocClient(credentials);
  const partitionedKey = getPartitionedKey(key, credentials?.tenantId);

  if (!customDocClient) {
    const db = readLocalDb();
    const idx = db.config.findIndex(c => c.key === partitionedKey);
    if (idx >= 0) db.config[idx].value = value;
    else db.config.push({ key: partitionedKey, value, tenantId: credentials?.tenantId });
    writeLocalDb(db);
    return true;
  }

  try {
    return await executeSaveConfig(customDocClient, key, partitionedKey, value, credentials);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn(`⚠️ Temp credentials expired/invalid for saveConfig [${key}]. Retrying with static system credentials...`);
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeSaveConfig(staticDocClient, key, partitionedKey, value, { tenantId: credentials.tenantId });
        } catch (retryError) {
          console.error(`❌ Retry saveConfig with static credentials failed for [${key}]:`, retryError);
        }
      }
    }
    console.error(`❌ DynamoDB saveConfig failed for ${partitionedKey}:`, error);
    const db = readLocalDb();
    const idx = db.config.findIndex(c => c.key === partitionedKey);
    if (idx >= 0) db.config[idx].value = value;
    else db.config.push({ key: partitionedKey, value, tenantId: credentials?.tenantId });
    writeLocalDb(db);
    return false;
  }
}

// Core Database Methods: Custom Receipts (Recibos)
async function executeGetRecibos(customDocClient: any, credentials?: any): Promise<ReciboPersonalizado[]> {
  const params: any = { TableName: TABLE_RECIBOS };
  if (credentials?.tenantId) {
    params.FilterExpression = "tenantId = :tenantId";
    params.ExpressionAttributeValues = {
      ":tenantId": credentials.tenantId,
    };
  }
  const res = await customDocClient.send(new ScanCommand(params));
  return (res.Items || []) as ReciboPersonalizado[];
}

export async function getRecibos(credentials?: AWSCredentials): Promise<ReciboPersonalizado[]> {
  const customDocClient = getDynamoDocClient(credentials);
  if (!customDocClient) {
    const local = readLocalDb().recibos || [];
    if (credentials?.tenantId) {
      return local.filter(r => r.tenantId === credentials.tenantId);
    }
    return local;
  }

  try {
    return await executeGetRecibos(customDocClient, credentials);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn("⚠️ Temp credentials expired/invalid for getRecibos. Retrying with static credentials...");
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeGetRecibos(staticDocClient, { tenantId: credentials.tenantId });
        } catch (retryError) {
          console.error("❌ Retry getRecibos with static credentials failed:", retryError);
        }
      }
    }
    console.warn("⚠️ Scan detektor_recibos failed, falling back to local list. Error:", error);
    const local = readLocalDb().recibos || [];
    if (credentials?.tenantId) {
      return local.filter(r => r.tenantId === credentials.tenantId);
    }
    return local;
  }
}

async function executeSaveRecibo(customDocClient: any, recibo: ReciboPersonalizado): Promise<boolean> {
  await customDocClient.send(
    new PutCommand({
      TableName: TABLE_RECIBOS,
      Item: recibo,
    })
  );
  return true;
}

export async function saveRecibo(recibo: ReciboPersonalizado, credentials?: AWSCredentials): Promise<boolean> {
  const customDocClient = getDynamoDocClient(credentials);
  if (credentials?.tenantId) {
    recibo.tenantId = credentials.tenantId;
  }

  if (!customDocClient) {
    const db = readLocalDb();
    if (!db.recibos) db.recibos = [];
    const idx = db.recibos.findIndex(r => r.id === recibo.id);
    if (idx >= 0) db.recibos[idx] = recibo;
    else db.recibos.push(recibo);
    writeLocalDb(db);
    return true;
  }

  try {
    return await executeSaveRecibo(customDocClient, recibo);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn("⚠️ Temp credentials expired/invalid for saveRecibo. Retrying with static credentials...");
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeSaveRecibo(staticDocClient, recibo);
        } catch (retryError) {
          console.error("❌ Retry saveRecibo with static credentials failed:", retryError);
        }
      }
    }
    console.error("❌ DynamoDB saveRecibo failed:", error);
    const db = readLocalDb();
    if (!db.recibos) db.recibos = [];
    const idx = db.recibos.findIndex(r => r.id === recibo.id);
    if (idx >= 0) db.recibos[idx] = recibo;
    else db.recibos.push(recibo);
    writeLocalDb(db);
    return false;
  }
}

async function executeDeleteRecibo(customDocClient: any, id: string): Promise<boolean> {
  await customDocClient.send(
    new DeleteCommand({
      TableName: TABLE_RECIBOS,
      Key: { id },
    })
  );
  return true;
}

export async function deleteRecibo(id: string, credentials?: AWSCredentials): Promise<boolean> {
  const customDocClient = getDynamoDocClient(credentials);
  if (!customDocClient) {
    const db = readLocalDb();
    if (db.recibos) {
      db.recibos = db.recibos.filter(r => r.id !== id);
    }
    writeLocalDb(db);
    return true;
  }

  try {
    return await executeDeleteRecibo(customDocClient, id);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn("⚠️ Temp credentials expired/invalid for deleteRecibo. Retrying with static credentials...");
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeDeleteRecibo(staticDocClient, id);
        } catch (retryError) {
          console.error("❌ Retry deleteRecibo with static credentials failed:", retryError);
        }
      }
    }
    console.error("❌ DynamoDB deleteRecibo failed:", error);
    const db = readLocalDb();
    if (db.recibos) {
      db.recibos = db.recibos.filter(r => r.id !== id);
    }
    writeLocalDb(db);
    return false;
  }
}

// NEW TABLE: Core Database Support for "detektor_pagos"
async function executeGetPagos(customDocClient: any, credentials?: any): Promise<Pago[]> {
  const params: any = { TableName: TABLE_PAGOS };
  if (credentials?.tenantId) {
    params.FilterExpression = "tenantId = :tenantId";
    params.ExpressionAttributeValues = {
      ":tenantId": credentials.tenantId,
    };
  }
  const res = await customDocClient.send(new ScanCommand(params));
  return (res.Items || []) as Pago[];
}

export async function getPagos(credentials?: AWSCredentials): Promise<Pago[]> {
  const customDocClient = getDynamoDocClient(credentials);
  if (!customDocClient) {
    const local = readLocalDb().pagos || [];
    if (credentials?.tenantId) {
      return local.filter(p => p.tenantId === credentials.tenantId);
    }
    return local;
  }

  try {
    return await executeGetPagos(customDocClient, credentials);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn("⚠️ Temp credentials expired/invalid for getPagos. Retrying with static credentials...");
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeGetPagos(staticDocClient, { tenantId: credentials.tenantId });
        } catch (retryError) {
          console.error("❌ Retry getPagos with static credentials failed:", retryError);
        }
      }
    }
    console.warn("⚠️ Scan detektor_pagos failed, returning local state:", error);
    const local = readLocalDb().pagos || [];
    if (credentials?.tenantId) {
      return local.filter(p => p.tenantId === credentials.tenantId);
    }
    return local;
  }
}

async function executeSavePago(customDocClient: any, pago: Pago): Promise<boolean> {
  await customDocClient.send(
    new PutCommand({
      TableName: TABLE_PAGOS,
      Item: pago,
    })
  );
  return true;
}

export async function savePago(pago: Pago, credentials?: AWSCredentials): Promise<boolean> {
  const customDocClient = getDynamoDocClient(credentials);
  if (credentials?.tenantId) {
    pago.tenantId = credentials.tenantId;
  }
  if (!pago.id) {
    pago.id = `pago-${pago.recibo || String(Date.now())}`;
  }

  if (!customDocClient) {
    const db = readLocalDb();
    if (!db.pagos) db.pagos = [];
    const idx = db.pagos.findIndex(p => p.id === pago.id);
    if (idx >= 0) db.pagos[idx] = pago;
    else db.pagos.push(pago);
    writeLocalDb(db);
    return true;
  }

  try {
    return await executeSavePago(customDocClient, pago);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn("⚠️ Temp credentials expired/invalid for savePago. Retrying with static credentials...");
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeSavePago(staticDocClient, pago);
        } catch (retryError) {
          console.error("❌ Retry savePago with static credentials failed:", retryError);
        }
      }
    }
    console.error("❌ DynamoDB savePago failed:", error);
    const db = readLocalDb();
    if (!db.pagos) db.pagos = [];
    const idx = db.pagos.findIndex(p => p.id === pago.id);
    if (idx >= 0) db.pagos[idx] = pago;
    else db.pagos.push(pago);
    writeLocalDb(db);
    return false;
  }
}

async function executeDeletePago(customDocClient: any, id: string): Promise<boolean> {
  await customDocClient.send(
    new DeleteCommand({
      TableName: TABLE_PAGOS,
      Key: { id },
    })
  );
  return true;
}

export async function deletePago(id: string, credentials?: AWSCredentials): Promise<boolean> {
  const customDocClient = getDynamoDocClient(credentials);
  if (!customDocClient) {
    const db = readLocalDb();
    if (db.pagos) {
      db.pagos = db.pagos.filter(p => p.id !== id);
    }
    writeLocalDb(db);
    return true;
  }

  try {
    return await executeDeletePago(customDocClient, id);
  } catch (error: any) {
    const isSecurityError = error.name === "UnrecognizedClientException" || error.message?.includes("security token") || error.message?.includes("expired");
    if (isSecurityError && credentials) {
      console.warn("⚠️ Temp credentials expired/invalid for deletePago. Retrying with static credentials...");
      const staticDocClient = getDynamoDocClient(undefined);
      if (staticDocClient) {
        try {
          return await executeDeletePago(staticDocClient, id);
        } catch (retryError) {
          console.error("❌ Retry deletePago with static credentials failed:", retryError);
        }
      }
    }
    console.error("❌ DynamoDB deletePago failed:", error);
    const db = readLocalDb();
    if (db.pagos) {
      db.pagos = db.pagos.filter(p => p.id !== id);
    }
    writeLocalDb(db);
    return false;
  }
}

// Check database status
export function getDbStatus(credentials?: AWSCredentials): { mode: "dynamo" | "local"; error: string | null; fallbackFile: string } {
  // If dynamic credentials succeeded, we're in dynamo mode
  if (credentials && credentials.accessKeyId && credentials.secretAccessKey) {
    return {
      mode: "dynamo",
      error: null,
      fallbackFile: FALLBACK_FILE
    };
  }

  return {
    mode: useLocalFallback ? "local" : "dynamo",
    error: awsConnectionError,
    fallbackFile: FALLBACK_FILE,
  };
}
