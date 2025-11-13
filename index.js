import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import XLSX from "xlsx";
import { google } from "googleapis";

const app = express();
app.use(express.json());

// 🔹 Variables de entorno
const ACK_BASE =
  process.env.OLACLICK_ACK_BASE ||
  "https://api.olaclick.app/ms-notifications/public/integrations/webhook-events/";
const OUTGOING_AUTH_HEADER = process.env.OUTGOING_AUTH_HEADER || "";
const GOOGLE_SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// 🔹 Configura autenticación con Google Drive
const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SERVICE_ACCOUNT,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});
const drive = google.drive({ version: "v3", auth });

// 🔹 Función para subir el Excel al Drive
async function subirExcelAGoogleDrive() {
  try {
    const fileName = `ventas-${new Date().toISOString().split("T")[0]}.xlsx`;

    // Verifica que el archivo exista antes de subirlo
    if (!fs.existsSync("ventas.xlsx")) {
      console.warn("⚠️ No existe ventas.xlsx para subir.");
      return;
    }

    const fileMetadata = {
      name: fileName,
      parents: [GOOGLE_DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: fs.createReadStream("ventas.xlsx"),
    };

    await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    console.log(`✅ ${fileName} subido correctamente a Google Drive`);
  } catch (error) {
    console.error("❌ Error subiendo archivo a Google Drive:", error);
  }
}

// 🔹 Ruta del webhook (OlaClick → tu servidor)
app.post("/api/olaclick/webhook", async (req, res) => {
  try {
    const event = req.body;

    console.log("=== Evento recibido de OlaClick ===");
    console.log("Tipo:", event?.event_type);
    console.log("ID del evento:", event?.event_id);
    console.log("Merchant:", event?.merchant_id);

    // Guarda o actualiza Excel (ejemplo básico)
    const pedidos = [
      {
        fecha: new Date().toLocaleString(),
        tipo: event?.event_type,
        id: event?.event_id,
        cliente: event?.data?.customer_name || "Cliente desconocido",
        total: event?.data?.order_total || 0,
      },
    ];

    // Crea o actualiza el archivo Excel
    const ws = XLSX.utils.json_to_sheet(pedidos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, "ventas.xlsx");

    // Sube a Google Drive
    await subirExcelAGoogleDrive();

    // Envío de confirmación (acknowledgement)
    if (event?.event_id) {
      const ackUrl = `${ACK_BASE}${event.event_id}`;
      const fetchOptions = { method: "PATCH", headers: {} };
      if (OUTGOING_AUTH_HEADER)
        fetchOptions.headers["Authorization"] = OUTGOING_AUTH_HEADER;

      try {
        const ackResp = await fetch(ackUrl, fetchOptions);
        console.log(`ACK enviado a OlaClick: ${ackUrl} → status ${ackResp.status}`);
      } catch (err) {
        console.error("Error al enviar ACK a OlaClick:", err);
      }
    } else {
      console.warn("⚠️ No se encontró event_id, no se envió ACK.");
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error procesando webhook:", error);
    res.sendStatus(500);
  }
});

// 🔹 Puerto que Render asigna automáticamente
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
});
