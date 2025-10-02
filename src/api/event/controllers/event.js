'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::event.event', ({ strapi }) => ({

  // async find(ctx) {
  //   // Sare events lao sath me user aur tickets populate karo
  //   const events = await strapi.db.query('api::event.event').findMany({
  //     populate: {
  //       user: true,
  //       tickets: {
  //         populate: { user: true }
  //       }
  //     }
  //   });

  //   // Har event ke sath sold/remaining tickets calculate karna
  //   const result = events.map(event => {
  //     const soldTickets = event.tickets
  //       .filter(t => t.paymentStatus === "success")
  //       .reduce((acc, t) => acc + t.quantity, 0);

  //     return {
  //       id: event.id,
  //       title: event.title,
  //       description: event.description,
  //       location: event.location,
  //       date: event.date,
  //       thumbnail: event.thumbnail,
  //       totalTickets: event.totalTickets,
  //       ticketPrice: event.ticketPrice,
  //       ticketSellingStart: event.ticketSellingStart,
  //       ticketSellingEnd: event.ticketSellingEnd,
  //       highlights: event.highlights,
  //       createdBy: {
  //         id: event.user?.id,
  //         username: event.user?.username,
  //         email: event.user?.email,
  //       },
  //       soldTickets,
  //       remainingTickets: event.totalTickets - soldTickets
  //     };
  //   });

  //   return result;
  // },

  async create(ctx) {
    const user = ctx.state.user; // logged in user
    const body = ctx.request.body.data;

    const event = await strapi.db.query('api::event.event').create({
      data: {
        title: body.title,
        description: body.description,
        location: body.location,
        date: body.date,
        thumbnail: body.thumbnail, // media id bhejna hoga
        totalTickets: body.totalTickets,
        ticketPrice: body.ticketPrice,
        ticketSellingStart: body.ticketSellingStart,
        ticketSellingEnd: body.ticketSellingEnd,
        highlights: body.highlights, // json
        user: user.id
      },
      populate: { user: true }
    });

    return event;
  },

  async findOne(ctx) {
    const { id } = ctx.params;

    const event = await strapi.db.query('api::event.event').findOne({
      where: { id },
      populate: {
        user: true,
        tickets: {
          populate: { user: true }
        },
        highlight: true,
        ticket_info: true,
      }
    });


    // calculate sold tickets
    const soldTickets = event.tickets?.filter(t => t.paymentStatus === "success")
      .reduce((acc, t) => acc + t.quantity, 0) || 0;

    return {
      ...event,
      soldTickets,
      remainingTickets: event.totalTickets - soldTickets
    };
  }
}));
