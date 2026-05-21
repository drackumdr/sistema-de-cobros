import React from "react";
import { Cliente, ReciboPersonalizado, EmpresaData } from "../types";

interface ReceiptTicketProps {
  cliente?: Cliente;
  recibo?: ReciboPersonalizado | null;
  selectedFecha?: string;
  empresa: EmpresaData;
}

export const ReceiptTicket: React.FC<ReceiptTicketProps> = ({
  cliente,
  recibo,
  selectedFecha,
  empresa,
}) => {
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

  // Helper to format date
  const fmtDate = (s?: string) => {
    if (!s) return "—";
    const [y, m, d] = s.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getTicketContent = () => {
    if (recibo) {
      // Personalized receipt layout
      const subtotal = recibo.subtotal;
      const iva = recibo.ivaPercent ? Math.round(subtotal * (recibo.ivaPercent / 100)) : 0;
      const total = recibo.total;

      return (
        <div className="ticket-body" style={{ fontFamily: "Courier New, monospace", fontSize: "13px", color: "#000" }}>
          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            {empresa.logo && (
              <div style={{ marginBottom: "6px" }}>
                <img
                  src={getLogoSrc(empresa.logo)}
                  style={{ maxHeight: "55px", maxWidth: "160px", margin: "0 auto", objectFit: "contain", filter: "grayscale(100%) contrast(140%)" }}
                  alt="Logo"
                />
              </div>
            )}
            <div style={{ fontSize: "15px", fontWeight: "bold", textTransform: "uppercase" }}>
              {empresa.nombre || "DETEKTOR SEGURIDAD"}
            </div>
            {empresa.rfc && <div style={{ fontSize: "12px", marginTop: "2px" }}>RFC: {empresa.rfc}</div>}
            {empresa.dir && (
              <div style={{ fontSize: "11px", marginTop: "2px", lineHeight: "1.3", whiteSpace: "normal" }}>
                {empresa.dir}
              </div>
            )}
            <div style={{ fontSize: "12px", fontWeight: "bold", marginTop: "8px", border: "1.5px solid #000", display: "inline-block", padding: "2px 10px", borderRadius: "2px", textTransform: "uppercase" }}>
              RECIBO PERSONALIZADO
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }}></div>

          <table style={{ width: "100%", fontSize: "13px" }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: "bold", width: "40%" }}>Recibo:</td>
                <td style={{ textAlign: "right", fontWeight: "bold" }}>{recibo.numeroRecibo}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold" }}>Fecha:</td>
                <td style={{ textAlign: "right", fontWeight: "bold" }}>{fmtDate(recibo.fecha)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold" }}>Método:</td>
                <td style={{ textAlign: "right", textTransform: "capitalize" }}>{recibo.metodoPago}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }}></div>

          <div style={{ marginBottom: "6px", lineHeight: "1.4" }}>
            <div><strong>Cliente:</strong> {recibo.clienteNombre}</div>
            {recibo.clienteTel && <div><strong>Teléfono:</strong> {recibo.clienteTel}</div>}
            {recibo.clienteRfc && <div><strong>RFC:</strong> {recibo.clienteRfc}</div>}
            {recibo.clienteDir && <div style={{ whiteSpace: "normal" }}><strong>Dirección:</strong> {recibo.clienteDir}</div>}
          </div>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }}></div>

          <div style={{ marginBottom: "6px" }}>
            <div style={{ fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px", fontSize: "12px" }}>
              Conceptos / Artículos
            </div>
            <table style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px dotted #000" }}>
                  <th style={{ textAlign: "left", paddingBottom: "2px" }}>Desc</th>
                  <th style={{ textAlign: "center", paddingBottom: "2px" }}>Cant</th>
                  <th style={{ textAlign: "right", paddingBottom: "2px" }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {recibo.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: "left", padding: "3px 0", verticalAlign: "top", lineHeight: "1.2" }}>
                      <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase" }}>
                        [{item.tipo === "producto" ? "P" : "S"}]
                      </span>{" "}
                      {item.nombre}
                      {item.descuento ? (
                        <div style={{ fontSize: "11px", color: "#444" }}>Con {item.descuento}% desc.</div>
                      ) : null}
                    </td>
                    <td style={{ textAlign: "center", padding: "3px 0", verticalAlign: "top" }}>
                      {item.cantidad}
                    </td>
                    <td style={{ textAlign: "right", padding: "3px 0", verticalAlign: "top", fontWeight: "bold" }}>
                      ${Math.round(item.monto * item.cantidad * (1 - (item.descuento || 0) / 100)).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: "1px dotted #000", margin: "6px 0" }}></div>

          <table style={{ width: "100%", fontSize: "13px" }}>
            <tbody>
              <tr>
                <td style={{ textAlign: "right", width: "70%", fontWeight: "bold" }}>Subtotal:</td>
                <td style={{ textAlign: "right", fontWeight: "bold" }}>
                  ${subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </td>
              </tr>
              {recibo.ivaPercent ? (
                <tr>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>IVA ({recibo.ivaPercent}%):</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>
                    ${iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={2} style={{ padding: "4px 0" }}>
                  <div style={{ borderTop: "1px dotted #000", margin: "4px 0" }}></div>
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>TOTAL:</td>
                <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>
                  ${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }}></div>

          {recibo.notas && (
            <div style={{ fontSize: "11px", textAlign: "center", fontStyle: "italic", marginBottom: "15px", whiteSpace: "normal" }}>
              Notas: {recibo.notas}
            </div>
          )}

          <div style={{ marginTop: "30px", textAlign: "center" }}>
            <div style={{ borderTop: "1.5px solid #000", width: "75%", margin: "0 auto 4px auto" }}></div>
            <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase" }}>Firma de Conformidad</div>
            <div style={{ fontSize: "10px" }}>Recibí de acuerdo</div>
          </div>

          <div style={{ marginTop: "25px", textAlign: "center", fontSize: "12px", fontWeight: "bold", letterSpacing: "1px" }}>
            ¡GRACIAS POR SU PREFERENCIA!
          </div>
        </div>
      );
    } else if (cliente) {
      // Contract client service bill receipt layout
      const oPago = selectedFecha
        ? (cliente.pagos || []).find((p) => p.fecha === selectedFecha)
        : (cliente.pagos || []).slice(-1)[0];

      const mf = oPago ? Number(oPago.monto) : Math.round(cliente.monto * (1 - (cliente.descuento || 0) / 100));
      const rNum = oPago?.recibo || "REC-COPROB";
      const rFecha = oPago?.fecha || selectedFecha || new Date().toISOString().split("T")[0];
      
      const pDesde = oPago?.periodoDesde || cliente.proximoCobro;
      const pMap = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
      const addM = pMap[cliente.freq] || 1;
      const pDate = new Date(pDesde);
      pDate.setMonth(pDate.getMonth() + addM);
      pDate.setDate(pDate.getDate() - 1);
      const pHasta = oPago?.periodoHasta || pDate.toISOString().split("T")[0];

      return (
        <div className="ticket-body" style={{ fontFamily: "Courier New, monospace", fontSize: "13px", color: "#000" }}>
          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            {empresa.logo && (
              <div style={{ marginBottom: "6px" }}>
                <img
                  src={getLogoSrc(empresa.logo)}
                  style={{ maxHeight: "55px", maxWidth: "160px", margin: "0 auto", objectFit: "contain", filter: "grayscale(100%) contrast(140%)" }}
                  alt="Logo"
                />
              </div>
            )}
            <div style={{ fontSize: "15px", fontWeight: "bold", textTransform: "uppercase" }}>
              {empresa.nombre || "DETEKTOR SEGURIDAD"}
            </div>
            {empresa.rfc && <div style={{ fontSize: "12px", marginTop: "2px" }}>RFC: {empresa.rfc}</div>}
            {empresa.dir && (
              <div style={{ fontSize: "11px", marginTop: "2px", lineHeight: "1.3", whiteSpace: "normal" }}>
                {empresa.dir}
              </div>
            )}
            <div style={{ fontSize: "12px", fontWeight: "bold", marginTop: "8px", border: "1.5px solid #000", display: "inline-block", padding: "2px 10px", borderRadius: "2px", textTransform: "uppercase" }}>
              Recibo de Pago de Servicio
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }}></div>

          <table style={{ width: "100%", fontSize: "13px" }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: "bold", width: "40%" }}>Recibo:</td>
                <td style={{ textAlign: "right", fontWeight: "bold" }}>{rNum}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold" }}>Fecha:</td>
                <td style={{ textAlign: "right", fontWeight: "bold" }}>{fmtDate(rFecha)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }}></div>

          <div style={{ marginBottom: "6px", lineHeight: "1.4" }}>
            <div><strong>Cuenta:</strong> {cliente.cuenta}</div>
            <div><strong>Cliente:</strong> {cliente.nombre}</div>
            {cliente.tel && <div><strong>Teléfono:</strong> {cliente.tel}</div>}
            {cliente.rfc && <div><strong>RFC:</strong> {cliente.rfc}</div>}
            {cliente.dir && <div style={{ whiteSpace: "normal" }}><strong>Dirección:</strong> {cliente.dir}</div>}
          </div>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }}></div>

          <div style={{ marginBottom: "6px" }}>
            <div style={{ fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px", fontSize: "12px" }}>
              Concepto del Servicio
            </div>
            <table style={{ width: "100%", fontSize: "13px" }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: "left", paddingRight: "8px", lineHeight: "1.3" }}>
                    <strong>{cliente.servicio || "Servicio General"}</strong>
                    {cliente.desc && <div style={{ fontSize: "11px" }}>{cliente.desc}</div>}
                    <div style={{ fontSize: "11px" }}>Frecuencia: {cliente.freq.toUpperCase()}</div>
                    <div style={{ fontSize: "11px" }}>Periodo: {fmtDate(pDesde)} al {fmtDate(pHasta)}</div>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: "bold", verticalAlign: "top", whiteSpace: "nowrap" }}>
                    ${Number(cliente.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <table style={{ width: "100%", marginTop: "6px", fontSize: "13px" }}>
            <tbody>
              <tr>
                <td style={{ textAlign: "right", width: "70%", fontWeight: "bold" }}>Importe Base:</td>
                <td style={{ textAlign: "right", fontWeight: "bold" }}>
                  ${Number(cliente.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </td>
              </tr>
              {cliente.descuento ? (
                <tr>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>Descuento ({cliente.descuento}%):</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>
                    -${Math.round(cliente.monto * (cliente.descuento / 100)).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={2} style={{ padding: "4px 0" }}>
                  <div style={{ borderTop: "1px dotted #000", margin: "4px 0" }}></div>
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>TOTAL:</td>
                <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>
                  ${mf.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }}></div>

          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <div style={{ fontWeight: "bold", fontSize: "12px" }}>Próximo cobro: {fmtDate(cliente.proximoCobro)}</div>
            {cliente.notas && (
              <div style={{ fontSize: "11px", marginTop: "4px", fontStyle: "italic", whiteSpace: "normal" }}>
                Nota: {cliente.notas}
              </div>
            )}
          </div>

          <div style={{ marginTop: "30px", textAlign: "center" }}>
            <div style={{ borderTop: "1.5px solid #000", width: "75%", margin: "0 auto 4px auto" }}></div>
            <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase" }}>Firma de Conformidad</div>
            <div style={{ fontSize: "10px" }}>Recibí conforme</div>
          </div>

          <div style={{ marginTop: "25px", textAlign: "center", fontSize: "12px", fontWeight: "bold", letterSpacing: "1px" }}>
            ¡GRACIAS POR SU PREFERENCIA!
          </div>
        </div>
      );
    }

    return <div style={{ color: "red", padding: "10px" }}>No data to render</div>;
  };

  return (
    <div className="ticket-body-container bg-white p-4 text-black border border-neutral-300 rounded shadow-inner" style={{ maxWidth: "340px", width: "100%" }}>
      {getTicketContent()}
    </div>
  );
};
