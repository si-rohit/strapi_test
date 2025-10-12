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

    if (!user) {
      return ctx.unauthorized('You must be logged in to create an event');
    }

    const thumbnails = body.thumbnail || [];

    const event = await strapi.db.query('api::event.event').create({
      data: {
        title: body.title,
        description: body.description,
        location: body.location,
        date: body.date,
        // ticket_info: {
          // price: body.ticket_info.price,
          // quantity: body.ticket_info.quantity,
          // // saleStart: body.ticket_info.saleStart,
          // saleEnd: body.ticket_info.saleEnd,
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

      // 🟢 Step 3: Tickets save karna (for this event)
    const tickets = body.tickets || [];

    for (const t of tickets) {
      await strapi.db.query('api::ticket.ticket').create({
        data: {
          name: t.name,
          price: t.price,
          totalQuantity: t.quantity,
          soldQuantity: 0, // initially 0
          saleStart: t.saleStart,
          saleEnd: t.saleEnd,
          event: event.id, // relation to event
        },
      });
    }

    // 🟢 Step 4: Final populated event return karo
    const finalEvent = await strapi.db.query('api::event.event').findOne({
      where: { id: event.id },
      populate: {
        thumbnail: true,
        tickets: true,
        user: true,
      },
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
  },

  async update(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params; // Event ID from URL
    const body = ctx.request.body;

    try {
      // 🟢 1️⃣ Check event exists
      const existingEvent = await strapi.db.query('api::event.event').findOne({
        where: { id },
        populate: { tickets: true, thumbnail: true }
      });

      if (!existingEvent) {
        return ctx.notFound('Event not found');
      }

      // 🟢 2️⃣ Update base event info
      await strapi.db.query('api::event.event').update({
        where: { id },
        data: {
          title: body.title,
          description: body.description,
          location: body.location,
          date: body.date,
          type: body.type,
          categories: body.categories,
          ageLimit: body.highlight?.ageLimit,
          parking: body.highlight?.parking,
          doorTime: body.highlight?.doorTime,
        },
      });

      // 🟢 3️⃣ Update Thumbnails
      const newThumbnails = body.thumbnail || [];

      // Delete old thumbnails that are not in new list
      const oldThumbs = existingEvent.thumbnail || [];
      const toDelete = oldThumbs.filter(t => !newThumbnails.includes(t.url));

      for (const delThumb of toDelete) {
        await strapi.db.query('api::thumbnail.thumbnail').delete({
          where: { id: delThumb.id },
        });
      }

      // Add new thumbnails (if not already exist)
      for (const thumbUrl of newThumbnails) {
        const exists = oldThumbs.find(t => t.url === thumbUrl);
        if (!exists) {
          await strapi.db.query('api::thumbnail.thumbnail').create({
            data: { url: thumbUrl, event: id },
          });
        }
      }

      // 🟢 4️⃣ Update / Add / Delete Tickets
      const newTickets = body.tickets || [];
      const oldTickets = existingEvent.tickets || [];

      const oldTicketIds = oldTickets.map(t => t.id);
      const newTicketIds = newTickets.filter(t => t.id).map(t => t.id);

      // Delete tickets that were removed from frontend
      const toRemove = oldTicketIds.filter(oldId => !newTicketIds.includes(oldId));

      for (const ticketId of toRemove) {
        await strapi.db.query('api::ticket.ticket').delete({ where: { id: ticketId } });
      }

      // Update existing tickets or create new ones
      for (const t of newTickets) {
        if (t.id) {
          // Update old ticket
          await strapi.db.query('api::ticket.ticket').update({
            where: { id: t.id },
            data: {
              name: t.name,
              price: t.price,
              totalQuantity: t.quantity,
              saleStart: t.saleStart,
              saleEnd: t.saleEnd,
            },
          });
        } else {
          // Create new ticket
          await strapi.db.query('api::ticket.ticket').create({
            data: {
              name: t.name,
              price: t.price,
              totalQuantity: t.quantity,
              soldQuantity: 0,
              saleStart: t.saleStart,
              saleEnd: t.saleEnd,
              event: id,
            },
          });
        }
      }

      // 🟢 5️⃣ Return updated event with all relations
      const updatedEvent = await strapi.db.query('api::event.event').findOne({
        where: { id },
        populate: {
          thumbnail: true,
          tickets: true,
          user: true,
        },
      });

      return updatedEvent;
    } catch (error) {
      console.log("❌ Error updating event:", error);
      ctx.throw(500, "Failed to update event");
    }
  },

  async getEventByUser(ctx) {
    // const user = ctx.state.user;
    const user = ctx.params.id;

    console.log("user", user);

    const events = await strapi.db.query('api::event.event').findMany({
      where: { user: user },
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

    return events;
  },

}));
