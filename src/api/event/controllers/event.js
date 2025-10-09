'use strict';

const thumbnail = require('../../thumbnail/controllers/thumbnail');
const ticket = require('../../ticket/controllers/ticket');

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::event.event', ({ strapi }) => ({

  async find(ctx) {
    // Sare events lao sath me user aur tickets populate karo
    const events = await strapi.db.query('api::event.event').findMany({
      populate: {
        // user: true,
        tickets: {
          populate: { user: true }
        },
        thumbnail: true,
        categories: true,
        user: true,
      }
    });

    // Har event ke sath sold/remaining tickets calculate karna
    // const result = events.map(event => {
    //   const soldTickets = event.tickets
    //     .filter(t => t.paymentStatus === "success")
    //     .reduce((acc, t) => acc + t.quantity, 0);

    //   return {
    //     id: event.id,
    //     title: event.title,
    //     description: event.description,
    //     location: event.location,
    //     date: event.date,
    //     thumbnail: event.thumbnail,
    //     totalTickets: event.totalTickets,
    //     ticketPrice: event.ticketPrice,
    //     ticketSellingStart: event.ticketSellingStart,
    //     ticketSellingEnd: event.ticketSellingEnd,
    //     highlights: event.highlights,
    //     createdBy: {
    //       id: event.user?.id,
    //       username: event.user?.username,
    //       email: event.user?.email,
    //     },
    //     soldTickets,
    //     remainingTickets: event.totalTickets - soldTickets
    //   };
    // });

    return events;
  },

  async create(ctx) {
    const user = ctx.state.user; // logged in user
    const body = ctx.request.body;

    const thumbnails = body.thumbnail || [];

    const event = await strapi.db.query('api::event.event').create({
      data: {
        title: body.title,
        description: body.description,
        location: body.location,
        date: body.date,
        // ticket_info: {
          price: body.ticket_info.price,
          quantity: body.ticket_info.quantity,
          saleStart: body.ticket_info.saleStart,
          saleEnd: body.ticket_info.saleEnd,
        // },
        type: body.type,
        categories: body.categories, // array of category ids
        // highlight:{
          ageLimit: body.highlight.ageLimit,
          parking: body.highlight.parking,
          doorTime: body.highlight.doorTime,
        // },
        user: user.id,
        // speakers: body.speakers, // array of strings
      },
      populate: { user: true }
    });

    const savedThumbnails = [];
      for (const thumbUrl of thumbnails) {
        const newThumb = await strapi.db.query('api::thumbnail.thumbnail').create({
          data: {
            url: thumbUrl,
            event: event.id, // relation link kar diya
          },
        });
        savedThumbnails.push(newThumb.id);
      }
    
    // Ab event ko update karke thumbnails relation set kar do
    await strapi.db.query('api::event.event').update({
        where: { id: event.id },
        data: {
          thumbnail: savedThumbnails, // relation IDs set kar diye
        },
      });

      // 4️⃣ Final event return karo (populated thumbnails ke sath)
      const finalEvent = await strapi.db.query('api::event.event').findOne({
        where: { id: event.id },
        populate: ['thumbnail'],
      });


    return finalEvent;
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
        categories: true,
        thumbnail : true,
        speakers: true,
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
