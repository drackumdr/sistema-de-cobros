import React, { useState } from "react";
import { ReciboPersonalizado, Cliente, ItemReciboPersonalizado } from "../types";

interface CustomReceiptsTabProps {
  recibos: ReciboPersonalizado[];
  clientes: Cliente[];
  onSaveRecibo: (recibo: ReciboPersonalizado) => Promise<void>;
  onDeleteRecibo: (id: string) => Promise<void>;
  onVerRecibo: (recibo: ReciboPersonalizado) => void;
  showToast: (msg: string) => void;
}

export const CustomReceiptsTab: React.FC<CustomReceiptsTabProps> = ({
  recibos,
  clientes,
  onSaveRecibo,
  onDeleteRecibo,
  onVerRecibo,
  showToast,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<string>("");
  
  // New receipt states
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTel, setClienteTel] = useState("");
  const [clienteRfc, setClienteRfc] = useState("");
  const [clienteDir, setClienteDir] = useState("");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "tarjeta" | "otro">("efectivo");
  const [ivaPercent, setIvaPercent] = useState<number>(16);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemReciboPersonalizado[]>([
    { tipo: "producto", nombre: "", monto: 0, cantidad: 1, descuento: 0 },
  ]);

  // Handle client selection autocomplete
  const handleSelectCliente = (clienteId: string) => {
    setSelectedCliente(clienteId);
    if (!clienteId) {
      setClienteNombre("");
      setClienteTel("");
      setClienteRfc("");
      setClienteDir("");
      return;
    }
    const matched = clientes.find((c) => c.id === clienteId);
    if (matched) {
      setClienteNombre(matched.nombre);
      setClienteTel(matched.tel || "");
      setClienteRfc(matched.rfc || "");
      setClienteDir(matched.dir || "");
    }
  };

  const addItemRow = () => {
    setItems([...items, { tipo: "producto", nombre: "", monto: 0, cantidad: 1, descuento: 0 }]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) {
      showToast("⚠ El recibo debe tener al menos un concepto");
      return;
    }
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ItemReciboPersonalizado, value: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  // Calculations
  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const discountedUnit = item.monto * (1 - (item.descuento || 0) / 100);
      return sum + Math.round(discountedUnit * item.cantidad);
    }, 0);
  };

  const handleSave = async () => {
    if (!clienteNombre.trim()) {
      showToast("⚠ Escribe el nombre del cliente");
      return;
    }
    if (items.some((item) => !item.nombre.trim() || item.monto <= 0)) {
      showToast("⚠ Completa el nombre de los artículos y asegúrate de que el monto sea mayor a 0");
      return;
    }

    const subtotal = calculateSubtotal();
    const finalTotal = subtotal + Math.round(subtotal * (ivaPercent / 100));
    const nextNum = "RECP-" + String(Date.now()).slice(-4);

    const newRecibo: ReciboPersonalizado = {
      id: "rcp-" + Date.now(),
      numeroRecibo: nextNum,
      fecha: new Date().toISOString().split("T")[0],
      clienteId: selectedCliente || undefined,
      clienteNombre,
      clienteTel: clienteTel || undefined,
      clienteRfc: clienteRfc || undefined,
      clienteDir: clienteDir || undefined,
      items,
      subtotal,
      ivaPercent,
      total: finalTotal,
      metodoPago,
      notas: notes || undefined,
    };

    await onSaveRecibo(newRecibo);
    setIsCreating(false);
    
    // Reset form
    setSelectedCliente("");
    setClienteNombre("");
    setClienteTel("");
    setClienteRfc("");
    setClienteDir("");
    setMetodoPago("efectivo");
    setIvaPercent(16);
    setNotes("");
    setItems([{ tipo: "producto", nombre: "", monto: 0, cantidad: 1, descuento: 0 }]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-[#cbc5bc] shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-neutral-800">Recibios Personalizados por Productos y Servicios</h2>
          <p className="text-xs text-neutral-500">Emite facturas de mostrador o notas de remisión para accesorios, visitas técnicas o productos de alarma.</p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="btn btn-sm btn-primary flex items-center gap-2"
          >
            <i className="ti ti-plus"></i> Crear Nuevo Recibo
          </button>
        )}
      </div>

      {isCreating ? (
        <div className="bg-white p-6 rounded-xl border-2 border-[#cbc5bc] gap-4 flex flex-col shadow-md">
          <div className="flex justify-between items-center border-b pb-3 mb-2">
            <h3 className="text-md font-bold text-neutral-800 flex items-center gap-2">
              <i className="ti ti-file-invoice text-blue-600"></i> Generador de Recibo de Caja
            </h3>
            <button
              onClick={() => setIsCreating(false)}
              className="px-3 py-1 text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition"
            >
              Cancelar
            </button>
          </div>

          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
            Información del Cliente
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="field">
              <label className="text-sm font-semibold">Autocompletar de Clientes Activos</label>
              <select
                value={selectedCliente}
                onChange={(e) => handleSelectCliente(e.target.value)}
                className="p-2 border rounded bg-neutral-50 text-neutral-700"
              >
                <option value="">-- Cliente Casual o Nuevo --</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cuenta} - {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="text-sm font-semibold">Nombre del Cliente <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Ej. Juan Pérez García"
                className="p-2 border rounded"
              />
            </div>

            <div className="field">
              <label className="text-sm font-semibold">Teléfono de contacto</label>
              <input
                type="text"
                value={clienteTel}
                onChange={(e) => setClienteTel(e.target.value)}
                placeholder="Ej. 614-123-4567"
                className="p-2 border rounded"
              />
            </div>

            <div className="field">
              <label className="text-sm font-semibold">RFC / Matrícula Fiscal</label>
              <input
                type="text"
                value={clienteRfc}
                onChange={(e) => setClienteRfc(e.target.value)}
                placeholder="Ej. PEGJ800101XXX"
                className="p-2 border rounded"
              />
            </div>

            <div className="field md:col-span-2">
              <label className="text-sm font-semibold">Dirección de entrega o domicilio</label>
              <input
                type="text"
                value={clienteDir}
                onChange={(e) => setClienteDir(e.target.value)}
                placeholder="Calle, Número, Colonia, Ciudad"
                className="p-2 border rounded"
              />
            </div>
          </div>

          <hr className="my-2 border-dashed" />

          <div className="flex justify-between items-center mb-1">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Conceptos y Precios
            </div>
            <button
              onClick={addItemRow}
              className="text-xs font-semibold px-3 py-1 bg-blue-50 border border-blue-200 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1 transition"
            >
              <i className="ti ti-plus"></i> Agregar Fila
            </button>
          </div>

          <div className="space-y-3 bg-[#faf8f5] p-3 rounded-lg border">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border-b pb-3 md:pb-0 md:border-b-0">
                <div className="md:col-span-2">
                  <label className="text-semibold text-xs block mb-1">Tipo</label>
                  <select
                    value={item.tipo}
                    onChange={(e) => updateItem(index, "tipo", e.target.value)}
                    className="p-1 text-xs border rounded bg-white w-full"
                  >
                    <option value="producto">📦 Producto</option>
                    <option value="servicio">🛠 Servicio</option>
                  </select>
                </div>

                <div className="md:col-span-4">
                  <label className="text-semibold text-xs block mb-1">Descripción / Nombre</label>
                  <input
                    type="text"
                    value={item.nombre}
                    onChange={(e) => updateItem(index, "nombre", e.target.value)}
                    placeholder="Ej. Sensor de apertura, Tarjeta SIM, Visita técnica"
                    className="p-1 text-xs border rounded bg-white w-full"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-semibold text-xs block mb-1">Costo Unitario ($)</label>
                  <input
                    type="number"
                    value={item.monto || ""}
                    onChange={(e) => updateItem(index, "monto", Number(e.target.value))}
                    placeholder="0"
                    min="0"
                    className="p-1 text-xs border rounded bg-white w-full"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-semibold text-xs block mb-1">Cant</label>
                  <input
                    type="number"
                    value={item.cantidad || ""}
                    onChange={(e) => updateItem(index, "cantidad", Number(e.target.value))}
                    min="1"
                    className="p-1 text-xs border rounded bg-white w-full"
                  />
                </div>

                <div className="md:col-span-1.5">
                  <label className="text-semibold text-xs block mb-1">Desc %</label>
                  <input
                    type="number"
                    value={item.descuento || ""}
                    onChange={(e) => updateItem(index, "descuento", Number(e.target.value))}
                    min="0"
                    max="100"
                    placeholder="0"
                    className="p-1 text-xs border rounded bg-white w-full"
                  />
                </div>

                <div className="md:col-span-1.5 flex justify-end">
                  <button
                    onClick={() => removeItemRow(index)}
                    className="text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 p-1.5 rounded"
                    title="Eliminar fila"
                  >
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <hr className="my-2 border-dashed" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="field">
              <label className="text-xs font-semibold">Forma de Pago</label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value as any)}
                className="p-2 border rounded"
              >
                <option value="efectivo">💵 Efectivo</option>
                <option value="transferencia">🏦 Transferencia Bancaria</option>
                <option value="tarjeta">💳 Tarjeta Crédito/Débito</option>
                <option value="otro">⚙ Otro</option>
              </select>
            </div>

            <div className="field col-span-2">
              <label className="text-xs font-semibold">Notas del Recibo</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Entrega programada, Número de guía, Garantía de 1 año"
                className="p-2 border rounded"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center bg-[#e8f5e9] p-4 rounded-xl border border-green-200 mt-2">
            <div className="flex gap-4 items-center">
              <div>
                <span className="text-xs text-neutral-600 block font-semibold">IVA (%)</span>
                <select
                  value={ivaPercent}
                  onChange={(e) => setIvaPercent(Number(e.target.value))}
                  className="p-1 text-xs border rounded bg-white font-bold"
                >
                  <option value="0">0% (Sin IVA)</option>
                  <option value="8">8% (Fronterizo)</option>
                  <option value="16">16% (IVA Nacional)</option>
                </select>
              </div>
              <div className="text-neutral-700 bg-white border rounded px-3 py-1 text-xs">
                Subtotal: <strong>${calculateSubtotal().toLocaleString()} MXN</strong>
              </div>
            </div>
            <div className="text-right mt-3 md:mt-0">
              <div className="text-xs text-green-700 font-bold uppercase tracking-wider">Total Final a Facturar</div>
              <div className="text-xl font-extrabold text-green-800">
                ${Math.round(calculateSubtotal() * (1 + ivaPercent / 100)).toLocaleString()} MXN
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 border-t pt-3">
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 border rounded hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-700 text-white font-bold rounded hover:bg-green-800 flex items-center gap-1"
            >
              <i className="ti ti-device-floppy"></i> Guardar y Emitir Recibo
            </button>
          </div>
        </div>
      ) : null}

      {/* List of Custom Receipts */}
      <div className="bg-white rounded-xl border border-[#cbc5bc] overflow-hidden shadow-sm">
        <div className="bg-[#ede9e3] px-4 py-3 border-b flex justify-between items-center">
          <span className="text-sm font-bold text-neutral-700">Historial de Recibios Generados</span>
          <span className="text-xs bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full font-bold">
            {recibos.length} documento(s)
          </span>
        </div>

        {recibos.length === 0 ? (
          <div className="text-center p-8 text-neutral-500">
            <i className="ti ti-receipt text-3xl opacity-30 block mb-2"></i>
            <p className="text-sm">No se han registrado recibos personalizados todavía.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ tableLayout: "auto" }}>
              <thead className="bg-[#f5f3ef] text-neutral-600 text-xs font-bold border-b">
                <tr>
                  <th className="p-3">Recibo</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Forma Pago</th>
                  <th className="p-3 text-right">Importe</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#cbc5bc]">
                {recibos.slice().reverse().map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50">
                    <td className="p-3 font-mono font-bold text-blue-800 text-xs">{r.numeroRecibo}</td>
                    <td className="p-3">{r.fecha}</td>
                    <td className="p-3">
                      <div className="font-bold text-neutral-800">{r.clienteNombre}</div>
                      {r.clienteTel && <div className="text-xs text-neutral-500">{r.clienteTel}</div>}
                    </td>
                    <td className="p-3">
                      <span className="capitalize text-xs bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                        {r.metodoPago}
                      </span>
                    </td>
                    <td className="p-3 text-right font-extrabold text-neutral-800">
                      ${r.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => onVerRecibo(r)}
                          className="px-2 py-1 text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1 transition"
                          title="Previsualizar / Imprimir ticket"
                        >
                          <i className="ti ti-printer"></i> Ticket
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`¿Eliminar de forma irreversible el recibo ${r.numeroRecibo}?`)) {
                              await onDeleteRecibo(r.id);
                            }
                          }}
                          className="px-2 py-1 text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded"
                          title="Eliminar"
                        >
                          <i className="ti ti-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
