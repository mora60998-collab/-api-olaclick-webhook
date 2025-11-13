import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// URL base de OlaClick (producción por defecto)
const ACK_BASE = process.env.OLACLICK_ACK_BASE || "https://api.olaclick.app/ms-notifications/public/integrations/webhook-events/";

// Header de autorización opcional (si OlaClick lo requiere)
const OUTGOING_AUTH_HEADER = process.env.OUTGOING_AUTH_HEADER || "";

// Ruta del webhook donde OlaClick enviará los pedidos
app.post("/api/olaclick/webhook", async (req, res) => {
  try {
    const event = req.body;

    console.log("=== Evento recibido de OlaClick ===");
    console.log("Tipo:", event?.event_type);
    console.log("ID del evento:", event?.event_id);
    console.log("Merchant:", event?.merchant_id);
    console.log("Datos del pedido:", JSON.stringify(event?.data, null, 2));

    // Confirmación del evento (acknowledgement)
    if (event?.event_id) {
      const ackUrl = `${ACK_BASE}${event.event_id}`;
      const fetchOptions = { method: "PATCH", headers: {} };
      if (OUTGOING_AUTH_HEADER) fetchOptions.headers["Authorization"] = OUTGOING_AUTH_HEADER;

      try {
        const ackResp = await fetch(ackUrl, fetchOptions);
        console.log(`ACK enviado a OlaClick: ${ackUrl} → status ${ackResp.status}`);
      } catch (err) {
        console.error("Error al enviar ACK a OlaClick:", err);
      }
    } else {
      console.warn("⚠️ No se encontró event_id, no se envió ACK.");
    }

    // Respuesta de éxito a OlaClick
    res.sendStatus(200);
  } catch (error) {
    console.error("Error procesando webhook:", error);
    res.sendStatus(500);
  }
});

// Puerto que Render asigna automáticamente
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});
import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import XLSX from "xlsx";
import { google } from "googleapis";
