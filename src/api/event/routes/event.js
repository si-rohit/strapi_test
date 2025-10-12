'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/events',
      handler: 'event.create',
      config: {
        auth: {}, // ✅ object hona chahiye
      },
    },
    {
      method: 'PUT',
      path: '/events/:id',
      handler: 'event.update',
      config: {
        auth: {}, // ✅ object
        policies: ['api::event.is-owner'],
      },
    },
    {
      method: 'DELETE',
      path: '/events/:id',
      handler: 'event.delete',
      config: {
        auth: {}, // ✅ object
        policies: ['api::event.is-owner'],
      },
    },
    {
      method: 'GET',
      path: '/events',
      handler: 'event.find',
      config: {
        // auth: {} hata do → sab dekh sakte hain
      },
    },
    {
      method: 'GET',
      path: '/events/:id',
      handler: 'event.findOne',
      config: {
        // auth: {} hata do → sab dekh sakte hain
      },
    },
    {
      method: 'GET',
      path: '/events/user/:id',
      handler: 'event.getEventByUser',
      config: {
        auth: false, // disable JWT check completely
        policies: [], // no extra restrictions
        middlewares: [], // no middleware validation
      },
    },
  ],
};
