'use strict';
const { createCoreController } = require('@strapi/strapi').factories;
const QRCode = require('qrcode');
const crypto = require('crypto');

module.exports = createCoreController('api::ticket.ticket', ({ strapi }) => ({

  async findEventTicketsByUser(ctx) {
    try {
      const { eventId } = ctx.params;
      console.log("user", ctx.request.body.body);
      const body = ctx.request.body;
      const userId = body.body;

      if (!eventId) return ctx.badRequest("Event ID required");
      if (!userId) return ctx.unauthorized("User not provided");

      // 1️⃣ Fetch event details
      const event = await strapi.db.query("api::event.event").findOne({
        where: { id: parseInt(eventId) },
        populate: ["thumbnail"],
      });
      if (!event) return ctx.notFound("Event not found");

      // 2️⃣ Get all tickets under this event
      const tickets = await strapi.db.query("api::ticket.ticket").findMany({
        where: { event: eventId },
      });

      const ticketIds = tickets.map(t => t.id);

      // 3️⃣ Get user's purchased quantities
      const orderItems = await strapi.db.query("api::order-item.order-item").findMany({
        where: {
          ticket: { $in: ticketIds },
          order: { user: userId },
        },
        populate: ["ticket"],
      });

      // 4️⃣ Prepare detailed ticket list with unique QR per quantity
      const ticketData = [];

      for (const ticket of tickets) {
        const purchasedItems = orderItems.filter(oi => oi.ticket?.id === ticket.id);
        const totalQty = purchasedItems.reduce((sum, oi) => sum + (Number(oi.quantity) || 0), 0);

        const uniqueTickets = [];
        for (let i = 0; i < totalQty; i++) {
          // Generate unique ID for each unit
          const uniqueId = `${ticket.name.replace(/\s+/g, '').toUpperCase()}-${ticket.id}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          const qrCodeDataUrl = await QRCode.toDataURL(uniqueId);
          uniqueTickets.push({
            uniqueId,
            qr: qrCodeDataUrl,
          });
        }

        ticketData.push({
          ticketId: ticket.id,
          ticketName: ticket.name,
          price: ticket.price,
          quantityPurchased: totalQty,
          uniqueTickets,
        });
      }

      // 5️⃣ Final response
      ctx.body = {
        event: {
          id: event.id,
          title: event.title,
          location: event.location,
          date: event.date,
          time: event.time,
          thumbnail: event.thumbnail,
        },
        tickets: ticketData,
      };

    } catch (error) {
      console.error("Error generating tickets with QR:", error);
      ctx.internalServerError("Failed to generate event tickets info");
    }
  },
}));
