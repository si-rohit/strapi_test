'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::event.event', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user; // logged-in user
    if (!user) return ctx.unauthorized('You must be logged in');

    const data = {
      ...ctx.request.body,
      user: user.id, // attach user ID
    };

    const entity = await strapi.db.query('api::event.event').create({ data });
    return entity;
  },
}));
