'use strict';
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
  async create(ctx) {
    try {
      // console.log("create order", ctx.state.user);
      // const user = ctx.state.user; // logged in user
      const { event, tickets, totalAmount, paymentId,user } = ctx.c;

      if (!event || !tickets || !Array.isArray(tickets)) {
        return ctx.badRequest("Invalid request data");
      }

      // 1️⃣ Create main order
      const order = await strapi.db.query("api::order.order").create({
        data: {
          user: user,
          event,
          totalAmount,
          paymentId,
          paymentStatus: "paid", // since Stripe already done on frontend
        },
      });

      // 2️⃣ Create order items and update ticket quantities
      for (const t of tickets) {
        const ticket = await strapi.db.query("api::ticket.ticket").findOne({
          where: { id: t.ticketId },
        });

        if (!ticket) continue;

        // Create order item
        await strapi.db.query("api::order-item.order-item").create({
          data: {
            order: order.id,
            ticket: ticket.id,
            quantity: t.quantity,
            price: ticket.price,
            subtotal: ticket.price * t.quantity,
          },
        });

        // Update ticket sold count or remaining quantity
        await strapi.db.query("api::ticket.ticket").update({
          where: { id: ticket.id },
          data: {
            soldQuantity: (ticket.soldQuantity || 0) + t.quantity,
            remainingQuantity:
              (ticket.remainingQuantity || ticket.quantity) - t.quantity,
          },
        });
      }

      // 3️⃣ Populate and return final order with items
      const finalOrder = await strapi.db.query("api::order.order").findOne({
        where: { id: order.id },
        populate: ["event", "user", "order_items", "order_items.ticket"],
      });

      return finalOrder;
    } catch (err) {
      console.error("Order creation error:", err);
      return ctx.internalServerError("Failed to create order");
    }
  },

  async getUserOrdersByEvent(ctx) {
  try {
    const { userId } = ctx.params;

    if (!userId) {
      return ctx.badRequest("User ID required");
    }

    // 1️⃣ Get all orders for this user with event + ticket details
    const orders = await strapi.db.query("api::order.order").findMany({
      where: { user: userId },
      populate: {
        event: true,
        order_items: {
          populate: {
            ticket: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2️⃣ Group orders by event
    const eventMap = {};

    orders.forEach(order => {
      const event = order.event;
      if (!event) return;

      if (!eventMap[event.id]) {
        eventMap[event.id] = {
          eventId: event.id,
          eventTitle: event.title,
          location: event.location,
          date: event.date,
          thumbnail: event.thumbnail,
          totalTickets: 0,
          tickets: [],
        };
      }

      // 3️⃣ Add all tickets from this order to the event
      order.order_items.forEach(item => {
        const existingTicket = eventMap[event.id].tickets.find(
          t => t.ticketId === item.ticket?.id
        );

        if (existingTicket) {
          existingTicket.quantity += item.quantity;
        } else {
          eventMap[event.id].tickets.push({
            ticketId: item.ticket?.id,
            ticketName: item.ticket?.name,
            quantity: item.quantity,
            price: item.ticket?.price,
          });
        }

        eventMap[event.id].totalTickets += Number(item.quantity);
        // eventMap[event.id].totalAmount += Number(item.price * item.quantity);
      });
    });

    // 4️⃣ Convert to array
    const formattedEvents = Object.values(eventMap);

    return formattedEvents;

  } catch (error) {
    console.error("Get user orders by event error:", error);
    return ctx.internalServerError("Failed to fetch user event orders");
  }
}


}));
